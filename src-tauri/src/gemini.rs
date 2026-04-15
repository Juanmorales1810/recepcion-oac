use crate::models::OacData;

// ---------------------------------------------------------------------------
// Prompt para Gemini
// ---------------------------------------------------------------------------

const OAC_PROMPT: &str = r#"Actua como un sistema experto en lectura de OAC/Reclamo de distribucion electrica.

OBJETIVO
- Extraer datos de formularios impresos + manuscritos con alta precision.
- Corregir errores ortograficos evidentes sin inventar contenido.
- Entregar SIEMPRE JSON valido, sin texto adicional.

REGLAS CLAVE
1) Tipo de orden — hay 5 tipos posibles. Detectar en el campo "S.A.C. - Reclamo / O.T. N" cual opcion esta marcada (tilde, circulo, cruz, resaltado).

   a) SAC (8 digitos, ej: 21470807)
      - Esta marcado SAC. Cargar numero_sac. Dejar numero_ot y numero_reclamo = null.

   b) OT (5 digitos, ej: 62345)
      - Esta marcado OT y NO hay numero de reclamo. Cargar numero_ot. Dejar numero_sac y numero_reclamo = null.

   c) Reclamo (7 digitos, ej: 1263434)
      - Esta marcado Reclamo y NO hay numero de OT. Cargar numero_reclamo. Dejar numero_sac y numero_ot = null.

   d) Incidencia
      - No esta marcado ninguno de SAC/Reclamo/OT, pero en el formulario aparece la palabra "Incidencia".
      - Cargar numero_reclamo con el numero que aparezca junto a "Incidencia". Dejar numero_sac y numero_ot = null.
      - El numero_oac (formato *******-W-******) se usa para renombrar este tipo.

   e) Derivada
      - Tiene TANTO un numero de OT (5 digitos) COMO un numero de Reclamo (7 digitos) en el mismo formulario.
      - Cargar numero_ot Y numero_reclamo con sus valores. Dejar numero_sac = null.

   - Si hay ambiguedad entre tipos: priorizar Reclamo y registrar la duda en _metadata.notas.
   - Usar la cantidad de digitos como ayuda para validar: SAC=8, Reclamo=7, OT=5.
   - SIEMPRE llenar el campo "tipo_orden" en encabezado con el valor exacto: SAC, OT, Reclamo, Incidencia o Derivada.

2) Abajo del codigo de barras, hay un codigo con el formato *******-W-****** donde las 6 ultimas cifras con la letra W son el numero de OAC. Si este codigo es legible, usarlo para cargar numero_oac guardando el formato original.

3) Fecha obligatoria en formato dia/mes/anio
- Si la fecha viene con año de 2 digitos, inferir siglo usando la fecha actual como referencia (ej. si hoy es 2026 y la fecha es 01/01/26, asumir 2026; si la fecha es 01/01/30, asumir 2030).
- El campo encabezado.fecha DEBE salir como DD/MM/YYYY.
- Si viene con otro formato, convertirlo a DD/MM/YYYY.
- Si la fecha es futura o claramente invalida, devolver null y registrar el motivo en _metadata.notas.

4) Horas
- Formato obligatorio HH:mm (24h).
- Ejemplos: "1:50 pm" -> "13:50", "8" -> "08:00", "14hs" -> "14:00".

5) Contratista
- Valores permitidos: DISEI, CONELCI, GRANADA, PROMTEL, PERCAB.
- Aplicar fuzzy matching para errores menores de escritura (ej. "Dizei" -> "DISEI").
- Si no hay coincidencia razonable: null.

6) Coordenadas
- Extraer latitud y longitud como number (float), no string.
- Validar rango aproximado local: lat [-35,-27], lon [-70,-65].
- Fuera de rango: null y nota en metadata.

7) Manuscritos dificiles
- Si un texto es dudoso, devolver mejor lectura entre corchetes: "[palabra probable]".
- Si es ilegible total: null.

8) Normalizacion semantica
- Expandir abreviaturas tecnicas cuando sea claro:
  - "H A" o "H/A" -> "Hormigon Armado"
  - "MT" -> "Media Tension"
  - "BT" -> "Baja Tension"
  - "PAT" -> "Puesta a Tierra"
- Mantener nombres propios en formato Nombre Apellido.

SALIDA (OBLIGATORIA)
- Responder UNICAMENTE con este JSON y estas claves exactas.
- No agregar claves fuera del esquema.

{
  "_metadata": {
    "confianza_global": "alta | media | baja",
    "campos_dudosos": ["string"],
    "correcciones_realizadas": ["string"],
    "notas": ["string"]
  },
  "encabezado": {
    "tipo_orden": "SAC | OT | Reclamo | Incidencia | Derivada",
    "empresa": "string | null",
    "numero_reclamo": "string | null",
    "numero_ot": "string | null",
    "numero_oac": "string | null",
    "numero_sac": "string | null",
    "fecha": "DD/MM/YYYY | null",
    "usuario_nombre": "string | null",
    "suministro_nro": "string | null"
  },
  "ubicacion": {
    "direccion": "string | null",
    "barrio_villa": "string | null",
    "departamento": "string | null",
    "localidad": "string | null",
    "coordenadas": {
      "latitud": "number | null",
      "longitud": "number | null"
    }
  },
  "detalle_tecnico": {
    "motivo_reclamo": "string | null",
    "descripcion_falla": "string | null",
    "ubicacion_falla": "string | null",
    "codigo_trabajo": "string | null",
    "tipo_instalacion": "string | null",
    "elementos_afectados": "string | null"
  },
  "informe_campo": {
    "descripcion_manuscrita": "string | null",
    "trabajos_realizados": "string | null",
    "trabajos_pendientes": "string | null",
    "materiales_utilizados": "string | null",
    "apertura_puesto_medicion": "string | null"
  },
  "cierre": {
    "empresa_contratista": "string | null",
    "operarios": ["string"],
    "hora_inicio": "HH:mm | null",
    "hora_fin": "HH:mm | null",
    "estado_cierre": "string | null",
    "observaciones_cierre": "string | null"
  }
}"#;

pub fn build_prompt() -> String {
    let today = chrono::Local::now().format("%d/%m/%Y").to_string();
    format!("{OAC_PROMPT}\n\nCONTEXTO TEMPORAL\nLa fecha actual es {today}. Usa esto para completar años incompletos o ambiguos en las fechas del documento.")
}

/// Calls the Gemini API with a base64-encoded PDF and returns the extracted OAC data.
pub async fn extract_oac_from_pdf(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    base64_content: &str,
) -> Result<OacData, String> {
    let prompt_text = build_prompt();
    let request_body = serde_json::json!({
        "contents": [{
            "parts": [
                {
                    "inlineData": {
                        "mimeType": "application/pdf",
                        "data": base64_content
                    }
                },
                {
                    "text": prompt_text
                }
            ]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    });

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );

    // Retry loop for rate-limit (429) and server errors
    let mut response_text = String::new();
    let mut last_error: Option<String> = None;

    for attempt in 0..3u32 {
        if attempt > 0 {
            let wait = std::time::Duration::from_secs(15 * u64::from(attempt));
            eprintln!("[DEBUG] Reintento {} — esperando {}s...", attempt, wait.as_secs());
            tokio::time::sleep(wait).await;
        }

        eprintln!("[DEBUG] Enviando request a Gemini (intento {})...", attempt + 1);
        let start_time = std::time::Instant::now();

        let resp = match client.post(&url).json(&request_body).send().await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[DEBUG] Error de red tras {:.1}s: {}", start_time.elapsed().as_secs_f64(), e);
                last_error = Some(format!("Error de red: {}", e));
                continue;
            }
        };

        let status = resp.status();
        eprintln!("[DEBUG] Respuesta recibida: HTTP {} en {:.1}s", status.as_u16(), start_time.elapsed().as_secs_f64());

        let text = match resp.text().await {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[DEBUG] Error leyendo body: {}", e);
                last_error = Some(format!("Error al leer respuesta: {}", e));
                continue;
            }
        };

        eprintln!("[DEBUG] Body recibido: {} bytes", text.len());

        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            eprintln!("[DEBUG] Rate limit 429 — reintentando");
            last_error = Some("Rate limit (429). Reintentando...".to_string());
            continue;
        }

        if status.is_server_error() || status == reqwest::StatusCode::SERVICE_UNAVAILABLE {
            eprintln!("[DEBUG] Server error {} — reintentando", status.as_u16());
            last_error = Some(format!("Error del servidor ({}). Reintentando...", status.as_u16()));
            continue;
        }

        if !status.is_success() {
            eprintln!("[DEBUG] Error HTTP {}: {}", status.as_u16(), &text[..text.len().min(500)]);
            last_error = Some(format!("Error HTTP {}: {}", status.as_u16(), &text[..text.len().min(300)]));
            break;
        }

        response_text = text;
        last_error = None;
        break;
    }

    if let Some(err) = last_error {
        return Err(err);
    }

    eprintln!("[DEBUG] Parseando respuesta JSON...");
    let api_json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| {
            eprintln!("[DEBUG] Error parseo JSON: {}. Primeros 500 chars: {}", e, &response_text[..response_text.len().min(500)]);
            format!("Error al parsear respuesta API: {}", e)
        })?;

    // Check for API-level errors
    if let Some(error) = api_json.get("error") {
        let message = error
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("Error desconocido de la API");
        eprintln!("[DEBUG] Error de API: {}", message);
        return Err(format!("API: {}", message));
    }

    // Extract the text content from Gemini response
    let raw_json_text = api_json
        .get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(|p| p.get(0))
        .and_then(|p| p.get("text"))
        .and_then(|t| t.as_str())
        .ok_or_else(|| {
            eprintln!("[DEBUG] Sin contenido de texto. candidates: {:?}", api_json.get("candidates"));
            "La API no devolvió contenido de texto.".to_string()
        })?;

    eprintln!("[DEBUG] Parseando OAC JSON ({} chars)...", raw_json_text.len());
    parse_oac_json(raw_json_text)
}

fn parse_oac_json(raw: &str) -> Result<OacData, String> {
    let trimmed = raw.trim();
    let json_str = if trimmed.starts_with("```") {
        let start = trimmed.find('{').unwrap_or(0);
        let end = trimmed.rfind('}').map(|i| i + 1).unwrap_or(trimmed.len());
        &trimmed[start..end]
    } else {
        trimmed
    };
    serde_json::from_str(json_str).map_err(|e| format!("Error al parsear JSON OAC: {}", e))
}
