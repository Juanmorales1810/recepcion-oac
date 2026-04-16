mod commands;
mod config;
mod gemini;
mod models;
mod stamping;
mod supabase;

use std::io::Write;
use tauri::Manager;

pub use config::AppConfig;

#[tauri::command]
fn close_splashscreen(app: tauri::AppHandle) {
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.show();
        let _ = main_window.set_focus();
    }
    log_startup("Splash cerrado por el frontend, ventana principal visible");
}

/// Escribe un log de diagnóstico en %TEMP%\recepcion-oac-startup.log
fn log_startup(msg: &str) {
    let log_path = std::env::temp_dir().join("recepcion-oac-startup.log");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let _ = writeln!(f, "[{}] {}", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"), msg);
    }
}

fn load_env(app: &tauri::App) -> Result<(), String> {
    log_startup("--- Inicio de carga de .env ---");

    // 1. Junto al ejecutable (producción MSI)
    if let Ok(exe_path) = std::env::current_exe() {
        let exe_dir = exe_path.parent().unwrap_or(std::path::Path::new(".")).to_path_buf();
        log_startup(&format!("exe_dir: {}", exe_dir.display()));
        let env_path = exe_dir.join(".env");
        log_startup(&format!("Buscando .env en exe_dir: {} (existe: {})", env_path.display(), env_path.exists()));
        if env_path.exists() {
            dotenvy::from_path(&env_path)
                .map_err(|e| format!("Error cargando .env desde {}: {}", env_path.display(), e))?;
            log_startup("✓ .env cargado desde exe_dir");
            return Ok(());
        }
    }

    // 2. resource_dir de Tauri
    match app.path().resource_dir() {
        Ok(resource_dir) => {
            log_startup(&format!("resource_dir: {}", resource_dir.display()));
            let env_path = resource_dir.join(".env");
            log_startup(&format!("Buscando .env en resource_dir: {} (existe: {})", env_path.display(), env_path.exists()));
            if env_path.exists() {
                dotenvy::from_path(&env_path)
                    .map_err(|e| format!("Error cargando .env desde {}: {}", env_path.display(), e))?;
                log_startup("✓ .env cargado desde resource_dir");
                return Ok(());
            }

            // 2b. Buscar en subdirectorios del resource_dir (Tauri puede anidar con _up_)
            let alt_path = resource_dir.join("_up_").join(".env");
            log_startup(&format!("Buscando .env en resource_dir/_up_: {} (existe: {})", alt_path.display(), alt_path.exists()));
            if alt_path.exists() {
                dotenvy::from_path(&alt_path)
                    .map_err(|e| format!("Error cargando .env desde {}: {}", alt_path.display(), e))?;
                log_startup("✓ .env cargado desde resource_dir/_up_");
                return Ok(());
            }
        }
        Err(e) => {
            log_startup(&format!("Error obteniendo resource_dir: {}", e));
        }
    }

    // 3. Directorio de trabajo actual (desarrollo)
    let cwd = std::env::current_dir().unwrap_or_default();
    log_startup(&format!("cwd: {}", cwd.display()));
    if dotenvy::dotenv().is_ok() {
        log_startup("✓ .env cargado desde cwd");
        return Ok(());
    }

    let msg = format!(
        "No se encontró el archivo .env.\nBuscado en:\n- exe_dir\n- resource_dir\n- cwd: {}",
        cwd.display()
    );
    log_startup(&format!("✗ {}", msg));
    Err(msg)
}

fn show_error_dialog(msg: &str) {
    log_startup(&format!("ERROR FATAL: {}", msg));
    // Usar mshta.exe para mostrar un diálogo — funciona siempre en Windows sin FFI
    #[cfg(windows)]
    {
        let escaped = msg.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n");
        let script = format!(
            "javascript:var sh=new ActiveXObject('WScript.Shell');sh.Popup('{}', 0, 'Recepcion OAC - Error', 16);close()",
            escaped
        );
        let _ = std::process::Command::new("mshta").arg(script).status();
    }
    #[cfg(not(windows))]
    {
        eprintln!("ERROR: {}", msg);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log_startup("====== Iniciando Recepcion OAC ======");
    log_startup(&format!("PID: {}", std::process::id()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            log_startup("setup() iniciado");

            if let Err(e) = load_env(app) {
                log_startup(&format!("setup() fallo en load_env: {}", e));
                show_error_dialog(&e);
                return Err(e.into());
            }

            let gemini_api_key = std::env::var("GEMINI_API_KEY")
                .map_err(|_| "GEMINI_API_KEY no está definida en .env")?;
            let supabase_url = std::env::var("SUPABASE_URL")
                .map_err(|_| "SUPABASE_URL no está definida en .env")?;
            let supabase_key = std::env::var("SUPABASE_KEY")
                .map_err(|_| "SUPABASE_KEY no está definida en .env")?;

            log_startup("Variables de entorno cargadas correctamente");

            let config = AppConfig {
                gemini_api_key,
                gemini_model: std::env::var("GEMINI_MODEL")
                    .unwrap_or_else(|_| "gemini-2.5-flash".to_string()),
                supabase_url,
                supabase_key,
            };
            app.manage(config);
            log_startup("setup() completado exitosamente");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            close_splashscreen,
            commands::process_pdfs,
            supabase::get_oac_records,
            supabase::get_oac_record
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            let msg = format!("Error al iniciar la aplicación:\n\n{}", e);
            show_error_dialog(&msg);
            std::process::exit(1);
        });
}
