use std::fs;
use std::path::Path;

use base64::Engine;
use tauri::ipc::Channel;
use tauri::Manager;
use tauri::State;

use crate::config::AppConfig;
use crate::gemini;
use crate::models::{OacData, ProcessEvent, SupabaseRecord};
use crate::stamping;
use crate::supabase;

pub fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}

async fn carga_externa(_oac: &OacData) -> Result<String, String> {
    // TODO: Implementar envío a endpoint externo.
    // Cuando se integre, retornar "enviado" si fue exitoso o "error_carga" si falló.
    Ok("pendiente".to_string())
}

#[tauri::command]
pub async fn process_pdfs(
    source_folder: String,
    output_folder: String,
    config: State<'_, AppConfig>,
    app_handle: tauri::AppHandle,
    on_event: Channel<ProcessEvent>,
) -> Result<(), String> {
    let mut pdf_files: Vec<std::path::PathBuf> = fs::read_dir(&source_folder)
        .map_err(|e| format!("Error al leer la carpeta origen: {}", e))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_file()
                && path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.eq_ignore_ascii_case("pdf"))
                    .unwrap_or(false)
            {
                Some(path)
            } else {
                None
            }
        })
        .collect();

    pdf_files.sort();

    if pdf_files.is_empty() {
        return Err("No se encontraron archivos PDF en la carpeta origen.".to_string());
    }

    let total = pdf_files.len() as u32;
    on_event.send(ProcessEvent::Started { total }).ok();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {}", e))?;
    let mut processed = 0u32;
    let mut errors = 0u32;

    eprintln!("[DEBUG] Modelo Gemini: {}", config.gemini_model);
    eprintln!("[DEBUG] Total de PDFs a procesar: {}", total);

    for (index, pdf_path) in pdf_files.iter().enumerate() {
        let filename = pdf_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        eprintln!("[DEBUG] ──────────────────────────────────────");
        eprintln!("[DEBUG] [{}/{}] Archivo: {}", index + 1, total, filename);

        on_event
            .send(ProcessEvent::Processing {
                filename: filename.clone(),
                index: index as u32,
            })
            .ok();

        let pdf_bytes = match fs::read(pdf_path) {
            Ok(bytes) => bytes,
            Err(e) => {
                on_event
                    .send(ProcessEvent::Error {
                        filename,
                        error: format!("Error al leer archivo: {}", e),
                    })
                    .ok();
                errors += 1;
                continue;
            }
        };

        // Gemini inline limit: 20 MB
        if pdf_bytes.len() > 20 * 1024 * 1024 {
            on_event
                .send(ProcessEvent::Error {
                    filename,
                    error: "El archivo excede 20 MB (límite de la API).".to_string(),
                })
                .ok();
            errors += 1;
            continue;
        }

        eprintln!("[DEBUG] Tamaño PDF: {} KB", pdf_bytes.len() / 1024);

        let base64_content = base64::engine::general_purpose::STANDARD.encode(&pdf_bytes);

        eprintln!("[DEBUG] Base64 generado: {} KB", base64_content.len() / 1024);

        // Call Gemini API
        let mut oac = match gemini::extract_oac_from_pdf(
            &client,
            &config.gemini_api_key,
            &config.gemini_model,
            &base64_content,
        )
        .await
        {
            Ok(data) => data,
            Err(e) => {
                on_event
                    .send(ProcessEvent::Error {
                        filename,
                        error: e,
                    })
                    .ok();
                errors += 1;
                continue;
            }
        };

        eprintln!(
            "[DEBUG] OAC extraído — SAC: {:?}, OT: {:?}, Reclamo: {:?}, OAC: {:?}, Tipo: {:?}",
            oac.encabezado.numero_sac, oac.encabezado.numero_ot,
            oac.encabezado.numero_reclamo, oac.encabezado.numero_oac,
            oac.encabezado.tipo_orden
        );

        // --- Inferir tipo_orden si Gemini no lo devolvió ---
        if oac.encabezado.tipo_orden.as_deref().unwrap_or("").is_empty() {
            let has_r = oac.encabezado.numero_reclamo.as_deref().filter(|s| !s.is_empty()).is_some();
            let has_o = oac.encabezado.numero_ot.as_deref().filter(|s| !s.is_empty()).is_some();
            let has_s = oac.encabezado.numero_sac.as_deref().filter(|s| !s.is_empty()).is_some();
            let has_oac_w = oac.encabezado.numero_oac.as_deref().filter(|s| s.contains('W')).is_some();

            let inferred = if has_r && has_o {
                "Derivada"
            } else if has_oac_w && !has_o {
                "Incidencia"
            } else if has_r {
                "Reclamo"
            } else if has_o {
                "OT"
            } else if has_s {
                "SAC"
            } else {
                ""
            };

            if !inferred.is_empty() {
                eprintln!("[DEBUG] tipo_orden inferido: {}", inferred);
                oac.encabezado.tipo_orden = Some(inferred.to_string());
            }
        }

        // --- Para Incidencias, normalizar numero_oac a solo la parte W-XXXXXX ---
        if oac.encabezado.tipo_orden.as_deref() == Some("Incidencia") {
            if let Some(oac_num) = &oac.encabezado.numero_oac {
                if let Some(pos) = oac_num.rfind('W') {
                    let w_part = oac_num[pos..].to_string();
                    eprintln!("[DEBUG] Normalizando numero_oac para Incidencia: {} -> {}", oac_num, w_part);
                    oac.encabezado.numero_oac = Some(w_part);
                }
            }
        }

        on_event
            .send(ProcessEvent::Extracted {
                filename: filename.clone(),
                oac: oac.clone(),
            })
            .ok();

        // --- Carga externa (placeholder para endpoint futuro) ---
        let estado_carga = match carga_externa(&oac).await {
            Ok(estado) => estado,
            Err(_) => "error_carga".to_string(),
        };

        // Determine filename based on document type
        let has_reclamo = oac
            .encabezado
            .numero_reclamo
            .as_deref()
            .filter(|s| !s.is_empty());
        let has_ot = oac
            .encabezado
            .numero_ot
            .as_deref()
            .filter(|s| !s.is_empty());
        let has_sac = oac
            .encabezado
            .numero_sac
            .as_deref()
            .filter(|s| !s.is_empty());
        let has_oac = oac
            .encabezado
            .numero_oac
            .as_deref()
            .filter(|s| !s.is_empty());

        let tipo = oac
            .encabezado
            .tipo_orden
            .as_deref()
            .unwrap_or("");

        let claim_number = match tipo {
            "Derivada" => match (has_reclamo, has_ot) {
                (Some(reclamo), Some(ot)) => format!("{}_2 {}", reclamo, ot),
                _ => has_reclamo.or(has_ot).unwrap_or_default().to_string(),
            },
            "Incidencia" => {
                if let Some(oac_num) = has_oac {
                    let w_part = oac_num
                        .rfind('W')
                        .map(|pos| &oac_num[pos..])
                        .unwrap_or(oac_num);
                    w_part.to_string()
                } else {
                    has_reclamo.unwrap_or_default().to_string()
                }
            }
            "Reclamo" => has_reclamo.unwrap_or_default().to_string(),
            "OT" => has_ot.unwrap_or_default().to_string(),
            "SAC" => has_sac.unwrap_or_default().to_string(),
            // Fallback: inferir por campos presentes (compatibilidad)
            _ => {
                if let Some(reclamo) = has_reclamo {
                    if has_ot.is_some() {
                        format!("{}_2 {}", reclamo, has_ot.unwrap())
                    } else {
                        reclamo.to_string()
                    }
                } else if let Some(ot) = has_ot {
                    ot.to_string()
                } else if let Some(sac) = has_sac {
                    sac.to_string()
                } else {
                    on_event
                        .send(ProcessEvent::Error {
                            filename,
                            error: "No se encontró número de Reclamo, OT ni SAC en el documento."
                                .to_string(),
                        })
                        .ok();
                    errors += 1;
                    continue;
                }
            }
        };

        // Convert fecha DD/MM/YYYY -> DD_MM_YYYY for folder name
        let date_folder_name = match &oac.encabezado.fecha {
            Some(fecha) if !fecha.is_empty() => fecha.replace('/', "_"),
            _ => {
                on_event
                    .send(ProcessEvent::Error {
                        filename,
                        error: "No se encontró fecha en el documento.".to_string(),
                    })
                    .ok();
                errors += 1;
                continue;
            }
        };

        // Create date sub-folder inside output
        let date_folder = Path::new(&output_folder).join(&date_folder_name);
        if let Err(e) = fs::create_dir_all(&date_folder) {
            on_event
                .send(ProcessEvent::Error {
                    filename,
                    error: format!("Error al crear carpeta: {}", e),
                })
                .ok();
            errors += 1;
            continue;
        }

        // Build destination path; handle duplicate names
        let safe_name = sanitize_filename(&claim_number);
        let mut new_path = date_folder.join(format!("{}.pdf", safe_name));
        let mut counter = 1u32;
        while new_path.exists() {
            new_path = date_folder.join(format!("{}_{}.pdf", safe_name, counter));
            counter += 1;
        }

        if let Err(e) = fs::copy(pdf_path, &new_path) {
            on_event
                .send(ProcessEvent::Error {
                    filename,
                    error: format!("Error al copiar archivo: {}", e),
                })
                .ok();
            errors += 1;
            continue;
        }

        on_event
            .send(ProcessEvent::Moved {
                filename: filename.clone(),
                new_path: new_path.to_string_lossy().to_string(),
                claim_number,
                date_folder: date_folder_name,
            })
            .ok();

        // --- Sellado del PDF si la carga externa fue exitosa ---
        let sellado = if estado_carga == "enviado" || estado_carga == "pendiente" {
            if let Some(fecha) = &oac.encabezado.fecha {
                let color = stamping::determine_seal_color(fecha);
                let seal_filename = format!("{}.png", color.to_uppercase());

                // Resolve seal image: try Tauri resource path first, then dev fallback
                let seal_path = app_handle
                    .path()
                    .resource_dir()
                    .ok()
                    .map(|d| d.join("images").join(&seal_filename))
                    .filter(|p| p.exists())
                    .or_else(|| {
                        let dev = Path::new("images").join(&seal_filename);
                        if dev.exists() {
                            Some(dev)
                        } else {
                            None
                        }
                    });

                eprintln!(
                    "[DEBUG] Sellando PDF con color: {} — imagen: {:?}",
                    color, seal_path
                );

                match seal_path {
                    Some(path) => match stamping::stamp_pdf(&new_path, &path) {
                        Ok(()) => {
                            eprintln!(
                                "[DEBUG] PDF sellado correctamente con sello {}",
                                color
                            );
                            on_event
                                .send(ProcessEvent::Stamped {
                                    filename: filename.clone(),
                                    color: color.clone(),
                                })
                                .ok();
                            Some(color)
                        }
                        Err(e) => {
                            eprintln!("[DEBUG] Error al sellar PDF: {}", e);
                            on_event
                                .send(ProcessEvent::Error {
                                    filename: filename.clone(),
                                    error: format!("Error al sellar PDF: {}", e),
                                })
                                .ok();
                            None
                        }
                    },
                    None => {
                        eprintln!(
                            "[DEBUG] No se encontró imagen de sello: {}",
                            seal_filename
                        );
                        on_event
                            .send(ProcessEvent::Error {
                                filename: filename.clone(),
                                error: format!(
                                    "Imagen de sello no encontrada: {}",
                                    seal_filename
                                ),
                            })
                            .ok();
                        None
                    }
                }
            } else {
                None
            }
        } else {
            None
        };

        // --- Guardar en Supabase ---
        eprintln!("[DEBUG] Guardando en Supabase...");
        let record = SupabaseRecord::from_oac(
            &oac,
            estado_carga.clone(),
            filename.clone(),
            Some(new_path.to_string_lossy().to_string()),
            sellado,
        );

        match supabase::save_to_supabase(
            &client,
            &config.supabase_url,
            &config.supabase_key,
            &record,
        )
        .await
        {
            Ok(_) => {
                eprintln!("[DEBUG] Guardado en Supabase OK");
                on_event
                    .send(ProcessEvent::Saved {
                        filename: filename.clone(),
                        estado_carga,
                    })
                    .ok();
            }
            Err(e) => {
                eprintln!("[DEBUG] Error Supabase: {}", e);
                on_event
                    .send(ProcessEvent::Error {
                        filename: filename.clone(),
                        error: format!("Error al guardar en Supabase: {}", e),
                    })
                    .ok();
            }
        }

        processed += 1;
    }

    on_event
        .send(ProcessEvent::Complete { processed, errors })
        .ok();
    Ok(())
}
