use crate::config::AppConfig;
use crate::models::{OacRecord, SupabaseRecord};

pub async fn save_to_supabase(
    client: &reqwest::Client,
    supabase_url: &str,
    supabase_key: &str,
    record: &SupabaseRecord,
) -> Result<(), String> {
    let url = format!(
        "{}/rest/v1/oac_records",
        supabase_url.trim_end_matches('/')
    );
    let response = client
        .post(&url)
        .header("apikey", supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=minimal")
        .json(record)
        .send()
        .await
        .map_err(|e| format!("Error de red Supabase: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Supabase {} - {}", status, text));
    }

    Ok(())
}

#[tauri::command]
pub async fn get_oac_records(
    config: tauri::State<'_, AppConfig>,
) -> Result<Vec<OacRecord>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/rest/v1/oac_records?select=*&order=created_at.desc",
        config.supabase_url.trim_end_matches('/')
    );

    let response = client
        .get(&url)
        .header("apikey", &config.supabase_key)
        .header("Authorization", format!("Bearer {}", &config.supabase_key))
        .send()
        .await
        .map_err(|e| format!("Error de red: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Supabase {} - {}", status, text));
    }

    let records: Vec<OacRecord> = response
        .json()
        .await
        .map_err(|e| format!("Error al parsear registros: {}", e))?;

    Ok(records)
}

#[tauri::command]
pub async fn get_oac_record(
    id: i64,
    config: tauri::State<'_, AppConfig>,
) -> Result<OacRecord, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/rest/v1/oac_records?id=eq.{}&select=*",
        config.supabase_url.trim_end_matches('/'),
        id
    );

    let response = client
        .get(&url)
        .header("apikey", &config.supabase_key)
        .header("Authorization", format!("Bearer {}", &config.supabase_key))
        .header("Accept", "application/vnd.pgrst.object+json")
        .send()
        .await
        .map_err(|e| format!("Error de red: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Supabase {} - {}", status, text));
    }

    let record: OacRecord = response
        .json()
        .await
        .map_err(|e| format!("Error al parsear registro: {}", e))?;

    Ok(record)
}
