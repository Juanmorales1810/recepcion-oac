use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// OAC data structs (parsed from Gemini JSON response)
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct OacMetadata {
    #[serde(default)]
    pub confianza_global: Option<String>,
    #[serde(default)]
    pub campos_dudosos: Vec<String>,
    #[serde(default)]
    pub correcciones_realizadas: Vec<String>,
    #[serde(default)]
    pub notas: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct OacEncabezado {
    #[serde(default)]
    pub tipo_orden: Option<String>,
    #[serde(default)]
    pub empresa: Option<String>,
    #[serde(default)]
    pub numero_sac: Option<String>,
    #[serde(default)]
    pub numero_ot: Option<String>,
    #[serde(default)]
    pub fecha: Option<String>,
    #[serde(default)]
    pub usuario_nombre: Option<String>,
    #[serde(default)]
    pub suministro_nro: Option<String>,
    #[serde(default)]
    pub numero_reclamo: Option<String>,
    #[serde(default)]
    pub numero_oac: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct OacCoordenadas {
    #[serde(default)]
    pub latitud: Option<f64>,
    #[serde(default)]
    pub longitud: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct OacUbicacion {
    #[serde(default)]
    pub direccion: Option<String>,
    #[serde(default)]
    pub barrio_villa: Option<String>,
    #[serde(default)]
    pub departamento: Option<String>,
    #[serde(default)]
    pub localidad: Option<String>,
    #[serde(default)]
    pub coordenadas: OacCoordenadas,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct OacDetalleTecnico {
    #[serde(default)]
    pub motivo_reclamo: Option<String>,
    #[serde(default)]
    pub descripcion_falla: Option<String>,
    #[serde(default)]
    pub ubicacion_falla: Option<String>,
    #[serde(default)]
    pub codigo_falla: Option<String>,
    #[serde(default)]
    pub codigo_trabajo: Option<String>,
    #[serde(default)]
    pub tipo_instalacion: Option<String>,
    #[serde(default)]
    pub elementos_afectados: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct OacInformeCampo {
    #[serde(default)]
    pub descripcion_manuscrita: Option<String>,
    #[serde(default)]
    pub trabajos_realizados: Option<String>,
    #[serde(default)]
    pub trabajos_pendientes: Option<String>,
    #[serde(default)]
    pub materiales_utilizados: Option<String>,
    #[serde(default)]
    pub apertura_puesto_medicion: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct OacCierre {
    #[serde(default)]
    pub empresa_contratista: Option<String>,
    #[serde(default)]
    pub operarios: Vec<String>,
    #[serde(default)]
    pub hora_inicio: Option<String>,
    #[serde(default)]
    pub hora_fin: Option<String>,
    #[serde(default)]
    pub estado_cierre: Option<String>,
    #[serde(default)]
    pub observaciones_cierre: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct OacData {
    #[serde(default, alias = "_metadata")]
    pub metadata: OacMetadata,
    #[serde(default)]
    pub encabezado: OacEncabezado,
    #[serde(default)]
    pub ubicacion: OacUbicacion,
    #[serde(default)]
    pub detalle_tecnico: OacDetalleTecnico,
    #[serde(default)]
    pub informe_campo: OacInformeCampo,
    #[serde(default)]
    pub cierre: OacCierre,
}

// ---------------------------------------------------------------------------
// Supabase record (flat structure for PostgREST insert)
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize)]
pub struct SupabaseRecord {
    pub estado_carga: String,
    pub archivo_origen: String,
    pub archivo_destino: Option<String>,
    pub sellado: Option<String>,
    pub confianza_global: Option<String>,
    pub campos_dudosos: serde_json::Value,
    pub correcciones_realizadas: serde_json::Value,
    pub notas: serde_json::Value,
    pub tipo_orden: Option<String>,
    pub empresa: Option<String>,
    pub numero_sac: Option<String>,
    pub numero_ot: Option<String>,
    pub numero_reclamo: Option<String>,
    pub numero_oac: Option<String>,
    pub fecha: Option<String>,
    pub usuario_nombre: Option<String>,
    pub suministro_nro: Option<String>,
    pub direccion: Option<String>,
    pub barrio_villa: Option<String>,
    pub departamento: Option<String>,
    pub localidad: Option<String>,
    pub latitud: Option<f64>,
    pub longitud: Option<f64>,
    pub motivo_reclamo: Option<String>,
    pub descripcion_falla: Option<String>,
    pub ubicacion_falla: Option<String>,
    pub codigo_falla: Option<String>,
    pub codigo_trabajo: Option<String>,
    pub tipo_instalacion: Option<String>,
    pub elementos_afectados: Option<String>,
    pub descripcion_manuscrita: Option<String>,
    pub trabajos_realizados: Option<String>,
    pub trabajos_pendientes: Option<String>,
    pub materiales_utilizados: Option<String>,
    pub apertura_puesto_medicion: Option<String>,
    pub empresa_contratista: Option<String>,
    pub operarios: serde_json::Value,
    pub hora_inicio: Option<String>,
    pub hora_fin: Option<String>,
    pub estado_cierre: Option<String>,
    pub observaciones_cierre: Option<String>,
}

impl SupabaseRecord {
    pub fn from_oac(
        oac: &OacData,
        estado_carga: String,
        archivo_origen: String,
        archivo_destino: Option<String>,
        sellado: Option<String>,
    ) -> Self {
        Self {
            estado_carga,
            archivo_origen,
            archivo_destino,
            sellado,
            confianza_global: oac.metadata.confianza_global.clone(),
            campos_dudosos: serde_json::to_value(&oac.metadata.campos_dudosos).unwrap_or_default(),
            correcciones_realizadas: serde_json::to_value(
                &oac.metadata.correcciones_realizadas,
            )
            .unwrap_or_default(),
            notas: serde_json::to_value(&oac.metadata.notas).unwrap_or_default(),
            tipo_orden: oac.encabezado.tipo_orden.clone(),
            empresa: oac.encabezado.empresa.clone(),
            numero_sac: oac.encabezado.numero_sac.clone(),
            numero_ot: oac.encabezado.numero_ot.clone(),
            numero_reclamo: oac.encabezado.numero_reclamo.clone(),
            numero_oac: oac.encabezado.numero_oac.clone(),
            fecha: oac.encabezado.fecha.clone(),
            usuario_nombre: oac.encabezado.usuario_nombre.clone(),
            suministro_nro: oac.encabezado.suministro_nro.clone(),
            direccion: oac.ubicacion.direccion.clone(),
            barrio_villa: oac.ubicacion.barrio_villa.clone(),
            departamento: oac.ubicacion.departamento.clone(),
            localidad: oac.ubicacion.localidad.clone(),
            latitud: oac.ubicacion.coordenadas.latitud,
            longitud: oac.ubicacion.coordenadas.longitud,
            motivo_reclamo: oac.detalle_tecnico.motivo_reclamo.clone(),
            descripcion_falla: oac.detalle_tecnico.descripcion_falla.clone(),
            ubicacion_falla: oac.detalle_tecnico.ubicacion_falla.clone(),
            codigo_falla: oac.detalle_tecnico.codigo_falla.clone(),
            codigo_trabajo: oac.detalle_tecnico.codigo_trabajo.clone(),
            tipo_instalacion: oac.detalle_tecnico.tipo_instalacion.clone(),
            elementos_afectados: oac.detalle_tecnico.elementos_afectados.clone(),
            descripcion_manuscrita: oac.informe_campo.descripcion_manuscrita.clone(),
            trabajos_realizados: oac.informe_campo.trabajos_realizados.clone(),
            trabajos_pendientes: oac.informe_campo.trabajos_pendientes.clone(),
            materiales_utilizados: oac.informe_campo.materiales_utilizados.clone(),
            apertura_puesto_medicion: oac.informe_campo.apertura_puesto_medicion.clone(),
            empresa_contratista: oac.cierre.empresa_contratista.clone(),
            operarios: serde_json::to_value(&oac.cierre.operarios).unwrap_or_default(),
            hora_inicio: oac.cierre.hora_inicio.clone(),
            hora_fin: oac.cierre.hora_fin.clone(),
            estado_cierre: oac.cierre.estado_cierre.clone(),
            observaciones_cierre: oac.cierre.observaciones_cierre.clone(),
        }
    }
}

// ---------------------------------------------------------------------------
// OAC record from Supabase (read)
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OacRecord {
    pub id: i64,
    pub estado_carga: String,
    pub archivo_origen: String,
    #[serde(default)]
    pub archivo_destino: Option<String>,
    #[serde(default)]
    pub sellado: Option<String>,
    #[serde(default)]
    pub confianza_global: Option<String>,
    #[serde(default)]
    pub campos_dudosos: serde_json::Value,
    #[serde(default)]
    pub correcciones_realizadas: serde_json::Value,
    #[serde(default)]
    pub notas: serde_json::Value,
    #[serde(default)]
    pub tipo_orden: Option<String>,
    #[serde(default)]
    pub empresa: Option<String>,
    #[serde(default)]
    pub numero_sac: Option<String>,
    #[serde(default)]
    pub numero_ot: Option<String>,
    #[serde(default)]
    pub numero_reclamo: Option<String>,
    #[serde(default)]
    pub numero_oac: Option<String>,
    #[serde(default)]
    pub fecha: Option<String>,
    #[serde(default)]
    pub usuario_nombre: Option<String>,
    #[serde(default)]
    pub suministro_nro: Option<String>,
    #[serde(default)]
    pub direccion: Option<String>,
    #[serde(default)]
    pub barrio_villa: Option<String>,
    #[serde(default)]
    pub departamento: Option<String>,
    #[serde(default)]
    pub localidad: Option<String>,
    #[serde(default)]
    pub latitud: Option<f64>,
    #[serde(default)]
    pub longitud: Option<f64>,
    #[serde(default)]
    pub motivo_reclamo: Option<String>,
    #[serde(default)]
    pub descripcion_falla: Option<String>,
    #[serde(default)]
    pub ubicacion_falla: Option<String>,
    #[serde(default)]
    pub codigo_falla: Option<String>,
    #[serde(default)]
    pub codigo_trabajo: Option<String>,
    #[serde(default)]
    pub tipo_instalacion: Option<String>,
    #[serde(default)]
    pub elementos_afectados: Option<String>,
    #[serde(default)]
    pub descripcion_manuscrita: Option<String>,
    #[serde(default)]
    pub trabajos_realizados: Option<String>,
    #[serde(default)]
    pub trabajos_pendientes: Option<String>,
    #[serde(default)]
    pub materiales_utilizados: Option<String>,
    #[serde(default)]
    pub apertura_puesto_medicion: Option<String>,
    #[serde(default)]
    pub empresa_contratista: Option<String>,
    #[serde(default)]
    pub operarios: serde_json::Value,
    #[serde(default)]
    pub hora_inicio: Option<String>,
    #[serde(default)]
    pub hora_fin: Option<String>,
    #[serde(default)]
    pub estado_cierre: Option<String>,
    #[serde(default)]
    pub observaciones_cierre: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

// ---------------------------------------------------------------------------
// Channel events sent to the frontend
// ---------------------------------------------------------------------------

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
    Extracted {
        filename: String,
        oac: OacData,
    },
    Saved {
        filename: String,
        estado_carga: String,
    },
    Stamped {
        filename: String,
        color: String,
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
