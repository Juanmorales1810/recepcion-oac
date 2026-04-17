use std::fs;
use std::path::Path;

use chrono::{Datelike, NaiveDate, Weekday};

// ---------------------------------------------------------------------------
// Business day helpers
// ---------------------------------------------------------------------------

fn business_days_in_month_up_to(year: i32, month: u32, day: u32) -> u32 {
    let mut count = 0;
    for d in 1..=day {
        if let Some(date) = NaiveDate::from_ymd_opt(year, month, d) {
            match date.weekday() {
                Weekday::Sat | Weekday::Sun => {}
                _ => count += 1,
            }
        }
    }
    count
}

/// Counts how many business days (Mon-Fri) are between two dates (exclusive of `from`, inclusive of `to`).
/// Returns 0 if `from >= to`.
fn business_days_between(from: NaiveDate, to: NaiveDate) -> i64 {
    if from >= to {
        return 0;
    }
    let mut count = 0i64;
    let mut d = from;
    loop {
        d = d.succ_opt().unwrap_or(d);
        if d > to {
            break;
        }
        match d.weekday() {
            Weekday::Sat | Weekday::Sun => {}
            _ => count += 1,
        }
    }
    count
}

// ---------------------------------------------------------------------------
// Seal color determination
// ---------------------------------------------------------------------------

/// Determines the seal color based on the OAC date vs current date.
/// - VERDE: fecha is within the last 2 *business days* (Mon-Fri) from today
/// - NEGRO: fecha from last month AND today is past the first 5 business days of current month
/// - ROJO: everything else
pub fn determine_seal_color(fecha_str: &str) -> String {
    let today = chrono::Local::now().date_naive();

    let fecha = match NaiveDate::parse_from_str(fecha_str, "%d/%m/%Y") {
        Ok(d) => d,
        Err(_) => return "rojo".to_string(),
    };

    if fecha > today {
        return "verde".to_string();
    }

    let biz_gap = business_days_between(fecha, today);
    if biz_gap <= 2 {
        return "verde".to_string();
    }

    let last_month_date = if today.month() == 1 {
        NaiveDate::from_ymd_opt(today.year() - 1, 12, 1)
    } else {
        NaiveDate::from_ymd_opt(today.year(), today.month() - 1, 1)
    };

    if let Some(lm_start) = last_month_date {
        if fecha.year() == lm_start.year() && fecha.month() == lm_start.month() {
            let biz_days = business_days_in_month_up_to(today.year(), today.month(), today.day());
            if biz_days > 5 {
                return "negro".to_string();
            }
        }
    }

    "rojo".to_string()
}

// ---------------------------------------------------------------------------
// PDF stamping
// ---------------------------------------------------------------------------

/// Stamps a PDF with a seal image overlay on the first page and sets read-only permissions.
pub fn stamp_pdf(pdf_path: &Path, seal_image_path: &Path) -> Result<(), String> {
    use lopdf::{Document, Object, Stream, Dictionary, dictionary, ObjectId};
    use image::GenericImageView;

    let img = image::open(seal_image_path)
        .map_err(|e| format!("Error al abrir imagen de sello: {}", e))?;
    let (img_width, img_height) = img.dimensions();

    let rgba_img = img.to_rgba8();

    let pixel_count = (img_width * img_height) as usize;
    let mut rgb_bytes = Vec::with_capacity(pixel_count * 3);
    let mut alpha_bytes = Vec::with_capacity(pixel_count);
    for pixel in rgba_img.pixels() {
        rgb_bytes.push(pixel[0]);
        rgb_bytes.push(pixel[1]);
        rgb_bytes.push(pixel[2]);
        alpha_bytes.push(pixel[3]);
    }

    let mut doc = Document::load(pdf_path)
        .map_err(|e| format!("Error al abrir PDF: {}", e))?;

    let has_alpha = alpha_bytes.iter().any(|&a| a != 255);

    let smask_id = if has_alpha {
        let smask_stream = Stream::new(
            lopdf::dictionary! {
                "Type" => "XObject",
                "Subtype" => "Image",
                "Width" => img_width as i64,
                "Height" => img_height as i64,
                "ColorSpace" => "DeviceGray",
                "BitsPerComponent" => 8_i64,
            },
            alpha_bytes,
        ).with_compression(true);
        Some(doc.add_object(smask_stream))
    } else {
        None
    };

    let mut img_dict = lopdf::dictionary! {
        "Type" => "XObject",
        "Subtype" => "Image",
        "Width" => img_width as i64,
        "Height" => img_height as i64,
        "ColorSpace" => "DeviceRGB",
        "BitsPerComponent" => 8_i64,
    };

    if let Some(smask_ref) = smask_id {
        img_dict.set("SMask", Object::Reference(smask_ref));
    }

    let img_stream = Stream::new(img_dict, rgb_bytes).with_compression(true);
    let img_id = doc.add_object(img_stream);

    let pages = doc.get_pages();
    let first_page_id = match pages.values().next() {
        Some(id) => *id,
        None => return Err("PDF sin páginas".to_string()),
    };

    fn resolve_object_id(_doc: &Document, obj: &Object) -> Option<ObjectId> {
        match obj {
            Object::Reference(id) => Some(*id),
            _ => None,
        }
    }

    let (page_width, page_height) = {
        let page = doc.get_object(first_page_id)
            .map_err(|e| format!("Error al obtener página: {}", e))?;
        if let Ok(dict) = page.as_dict() {
            if let Ok(media_box) = dict.get(b"MediaBox") {
                if let Ok(arr) = media_box.as_array() {
                    let w = arr.get(2).and_then(|v| match v {
                        Object::Integer(i) => Some(*i as f32),
                        Object::Real(f) => Some(*f as f32),
                        _ => None,
                    }).unwrap_or(612.0);
                    let h = arr.get(3).and_then(|v| match v {
                        Object::Integer(i) => Some(*i as f32),
                        Object::Real(f) => Some(*f as f32),
                        _ => None,
                    }).unwrap_or(792.0);
                    (w, h)
                } else { (612.0, 792.0) }
            } else { (612.0, 792.0) }
        } else { (612.0, 792.0) }
    };

    let stamp_width = page_width * 0.15;
    let stamp_height = stamp_width * (img_height as f32 / img_width as f32);
    let x = page_width - stamp_width - 50.0;                    // 20 pts más a la izquierda
    let y = page_height / 2.0 - stamp_height / 2.0;            // centrado verticalmente

    let xobj_name = "SelloOAC";

    let page_obj = doc.get_object(first_page_id)
        .map_err(|e| format!("Error leyendo página: {}", e))?;
    let resources_ref: Option<ObjectId> = if let Ok(dict) = page_obj.as_dict() {
        if let Ok(res) = dict.get(b"Resources") {
            resolve_object_id(&doc, res)
        } else {
            None
        }
    } else {
        None
    };

    if let Some(res_id) = resources_ref {
        let res_obj = doc.get_object(res_id)
            .map_err(|e| format!("Error resolviendo Resources: {}", e))?;
        let xobj_ref: Option<ObjectId> = if let Ok(res_dict) = res_obj.as_dict() {
            if let Ok(xo) = res_dict.get(b"XObject") {
                resolve_object_id(&doc, xo)
            } else {
                None
            }
        } else {
            None
        };

        if let Some(xo_id) = xobj_ref {
            let xo_obj = doc.get_object_mut(xo_id)
                .map_err(|e| format!("Error resolviendo XObject: {}", e))?;
            if let Object::Dictionary(ref mut xobj_dict) = *xo_obj {
                xobj_dict.set(xobj_name, img_id);
            }
        } else {
            let res_obj = doc.get_object_mut(res_id)
                .map_err(|e| format!("Error mutando Resources: {}", e))?;
            if let Object::Dictionary(ref mut res_dict) = *res_obj {
                if !res_dict.has(b"XObject") {
                    res_dict.set("XObject", Dictionary::new());
                }
                if let Ok(xobjects) = res_dict.get_mut(b"XObject") {
                    if let Object::Dictionary(ref mut xobj_dict) = *xobjects {
                        xobj_dict.set(xobj_name, img_id);
                    }
                }
            }
        }
    } else {
        let page_dict = doc.get_object_mut(first_page_id)
            .map_err(|e| format!("Error al obtener página mutable: {}", e))?;
        if let Object::Dictionary(ref mut dict) = *page_dict {
            if !dict.has(b"Resources") {
                dict.set("Resources", Dictionary::new());
            }
            if let Ok(resources) = dict.get_mut(b"Resources") {
                if let Object::Dictionary(ref mut res_dict) = *resources {
                    if !res_dict.has(b"XObject") {
                        res_dict.set("XObject", Dictionary::new());
                    }
                    if let Ok(xobjects) = res_dict.get_mut(b"XObject") {
                        if let Object::Dictionary(ref mut xobj_dict) = *xobjects {
                            xobj_dict.set(xobj_name, img_id);
                        }
                    }
                }
            }
        }
    }

    let content_ops = format!(
        "q {} 0 0 {} {} {} cm /{} Do Q",
        stamp_width, stamp_height, x, y, xobj_name
    );

    let content_stream = Stream::new(Dictionary::new(), content_ops.into_bytes())
        .with_compression(true);
    let content_id = doc.add_object(content_stream);

    let page_dict = doc.get_object_mut(first_page_id)
        .map_err(|e| format!("Error al obtener página mutable: {}", e))?;

    if let Object::Dictionary(ref mut dict) = *page_dict {
        if let Ok(contents) = dict.get(b"Contents") {
            match contents.clone() {
                Object::Reference(existing_ref) => {
                    dict.set("Contents", Object::Array(vec![
                        Object::Reference(existing_ref),
                        Object::Reference(content_id),
                    ]));
                }
                Object::Array(mut arr) => {
                    arr.push(Object::Reference(content_id));
                    dict.set("Contents", Object::Array(arr));
                }
                _ => {
                    dict.set("Contents", Object::Reference(content_id));
                }
            }
        } else {
            dict.set("Contents", Object::Reference(content_id));
        }
    }

    doc.save(pdf_path)
        .map_err(|e| format!("Error al guardar PDF sellado: {}", e))?;

    let metadata = fs::metadata(pdf_path)
        .map_err(|e| format!("Error al leer metadatos: {}", e))?;
    let mut perms = metadata.permissions();
    perms.set_readonly(true);
    fs::set_permissions(pdf_path, perms)
        .map_err(|e| format!("Error al establecer permisos de solo lectura: {}", e))?;

    let check = fs::metadata(pdf_path)
        .map(|m| m.permissions().readonly())
        .unwrap_or(false);
    eprintln!("[DEBUG] Archivo solo lectura: {} → {}", pdf_path.display(), check);

    Ok(())
}
