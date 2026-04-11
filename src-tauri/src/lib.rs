use std::fs;
use std::path::Path;

use base64::Engine;
use regex::Regex;
use serde::Serialize;
use tauri::ipc::Channel;

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum ProcessEvent {
    Started {
        total: u32,
    },
    Processing {
        filename: String,
        index: u32,
    },
    OcrResult {
        filename: String,
        claim_number: Option<String>,
        date: Option<String>,
        text_preview: String,
    },
    Moved {
        filename: String,
        new_path: String,
        claim_number: String,
        date_folder: String,
    },
    Error {
        filename: String,
        error: String,
    },
    Complete {
        processed: u32,
        errors: u32,
    },
}

#[tauri::command]
async fn process_pdfs(
    source_folder: String,
    output_folder: String,
    api_key: String,
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

    let client = reqwest::Client::new();
    let mut processed = 0u32;
    let mut errors = 0u32;

    for (index, pdf_path) in pdf_files.iter().enumerate() {
        let filename = pdf_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

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

        // Google Vision API inline content limit: 20 MB
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

        let base64_content = base64::engine::general_purpose::STANDARD.encode(&pdf_bytes);

        let request_body = serde_json::json!({
            "requests": [{
                "inputConfig": {
                    "content": base64_content,
                    "mimeType": "application/pdf"
                },
                "features": [{ "type": "DOCUMENT_TEXT_DETECTION" }]
            }]
        });

        let url = format!(
            "https://vision.googleapis.com/v1/files:annotate?key={}",
            api_key
        );

        let response = match client.post(&url).json(&request_body).send().await {
            Ok(resp) => resp,
            Err(e) => {
                on_event
                    .send(ProcessEvent::Error {
                        filename,
                        error: format!("Error de red: {}", e),
                    })
                    .ok();
                errors += 1;
                continue;
            }
        };

        let response_text = match response.text().await {
            Ok(text) => text,
            Err(e) => {
                on_event
                    .send(ProcessEvent::Error {
                        filename,
                        error: format!("Error al leer respuesta: {}", e),
                    })
                    .ok();
                errors += 1;
                continue;
            }
        };

        let json: serde_json::Value = match serde_json::from_str(&response_text) {
            Ok(v) => v,
            Err(e) => {
                on_event
                    .send(ProcessEvent::Error {
                        filename,
                        error: format!("Error al parsear respuesta: {}", e),
                    })
                    .ok();
                errors += 1;
                continue;
            }
        };

        // Check for API-level errors
        if let Some(error) = json.get("error") {
            let message = error
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Error desconocido de la API");
            on_event
                .send(ProcessEvent::Error {
                    filename,
                    error: format!("API: {}", message),
                })
                .ok();
            errors += 1;
            continue;
        }

        let full_text = extract_text_from_vision_response(&json);

        if full_text.trim().is_empty() {
            on_event
                .send(ProcessEvent::Error {
                    filename,
                    error: "No se detectó texto en el PDF.".to_string(),
                })
                .ok();
            errors += 1;
            continue;
        }

        let claim_number = extract_claim_number(&full_text);
        let date = extract_date(&full_text);

        let text_preview = full_text.chars().take(300).collect::<String>();

        on_event
            .send(ProcessEvent::OcrResult {
                filename: filename.clone(),
                claim_number: claim_number.clone(),
                date: date.clone(),
                text_preview,
            })
            .ok();

        let claim_number = match claim_number {
            Some(c) => c,
            None => {
                on_event
                    .send(ProcessEvent::Error {
                        filename,
                        error: "No se encontró número de reclamo en el texto.".to_string(),
                    })
                    .ok();
                errors += 1;
                continue;
            }
        };

        let date_folder_name = match date {
            Some(d) => d,
            None => {
                on_event
                    .send(ProcessEvent::Error {
                        filename,
                        error: "No se encontró fecha en el texto.".to_string(),
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
                filename,
                new_path: new_path.to_string_lossy().to_string(),
                claim_number,
                date_folder: date_folder_name,
            })
            .ok();

        processed += 1;
    }

    on_event
        .send(ProcessEvent::Complete { processed, errors })
        .ok();
    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn extract_text_from_vision_response(json: &serde_json::Value) -> String {
    let mut full_text = String::new();
    if let Some(responses) = json.get("responses").and_then(|r| r.as_array()) {
        for file_resp in responses {
            if let Some(pages) = file_resp.get("responses").and_then(|r| r.as_array()) {
                for page in pages {
                    if let Some(text) = page
                        .get("fullTextAnnotation")
                        .and_then(|a| a.get("text"))
                        .and_then(|t| t.as_str())
                    {
                        full_text.push_str(text);
                        full_text.push('\n');
                    }
                }
            }
        }
    }
    full_text
}

fn extract_claim_number(text: &str) -> Option<String> {
    let patterns = [
        r"(?i)(?:n[°ºo]\.?\s*(?:de\s+)?reclamo|reclamo\s*n[°ºo]?\.?|nro\.?\s*(?:de\s+)?reclamo|numero\s+de\s+reclamo|reclamo)\s*[:#\-\s]*(\d[\d\-/\.]*\d)",
        r"(?i)(?:expediente|exp\.?|exte\.?)\s*[:#\-\s]*(\d[\d\-/\.]*\d)",
        r"(?i)(?:rec|rcl)\s*[\.#\-:]\s*(\d[\d\-/\.]*\d)",
    ];
    for pattern in &patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(m) = caps.get(1) {
                    let number = m.as_str().to_string();
                    if number.len() >= 2 {
                        return Some(number);
                    }
                }
            }
        }
    }
    None
}

fn extract_date(text: &str) -> Option<String> {
    // dd/mm/yyyy  dd-mm-yyyy  dd.mm.yyyy
    if let Ok(re) = Regex::new(r"(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})") {
        if let Some(caps) = re.captures(text) {
            let day: u32 = caps[1].parse().unwrap_or(0);
            let month: u32 = caps[2].parse().unwrap_or(0);
            let year = &caps[3];
            if (1..=31).contains(&day) && (1..=12).contains(&month) {
                return Some(format!("{:02}_{:02}_{}", day, month, year));
            }
        }
    }

    // "12 de abril de 2026" style
    if let Ok(re) = Regex::new(
        r"(?i)(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+|del?\s+)?(\d{4})",
    ) {
        if let Some(caps) = re.captures(text) {
            let day: u32 = caps[1].parse().unwrap_or(0);
            let month_name = caps[2].to_lowercase();
            let year = &caps[3];
            let month = match month_name.as_str() {
                "enero" => 1,
                "febrero" => 2,
                "marzo" => 3,
                "abril" => 4,
                "mayo" => 5,
                "junio" => 6,
                "julio" => 7,
                "agosto" => 8,
                "septiembre" => 9,
                "octubre" => 10,
                "noviembre" => 11,
                "diciembre" => 12,
                _ => return None,
            };
            if (1..=31).contains(&day) {
                return Some(format!("{:02}_{:02}_{}", day, month, year));
            }
        }
    }

    None
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![process_pdfs])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
