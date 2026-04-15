mod commands;
mod config;
mod gemini;
mod models;
mod stamping;
mod supabase;

pub use config::AppConfig;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();

    let config = AppConfig {
        gemini_api_key: std::env::var("GEMINI_API_KEY")
            .expect("GEMINI_API_KEY no está definida en .env"),
        gemini_model: std::env::var("GEMINI_MODEL")
            .unwrap_or_else(|_| "gemini-2.5-flash".to_string()),
        supabase_url: std::env::var("SUPABASE_URL")
            .expect("SUPABASE_URL no está definida en .env"),
        supabase_key: std::env::var("SUPABASE_KEY")
            .expect("SUPABASE_KEY no está definida en .env"),
    };

    tauri::Builder::default()
        .manage(config)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::process_pdfs,
            supabase::get_oac_records,
            supabase::get_oac_record
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
