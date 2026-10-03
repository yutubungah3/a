window.DASHBOARD_CONFIG = {
  title: "Daily Breakdown Monitoring",
  subtitle: "Mining Equipment • Live Unit Status",
  company: "Operational Dashboard",
  sheetGid: "",
  refreshMs: 60000,
  fields: {
    unit: ["unit", "unit no", "unit_no", "no unit", "kode unit", "equipment", "equipment no", "equipment_no"],
    site: ["site", "jobsite", "project", "lokasi", "location"],
    status: ["status", "unit status", "unit_status", "condition", "kondisi"],
    remark: ["remark", "remarks", "keterangan", "description", "problem", "issue", "breakdown"],
    date: ["date", "tanggal", "update", "updated", "last update", "last_update", "tgl"],
    type: ["type", "jenis", "model", "fleet", "equipment type", "equipment_type"],
    pic: ["pic", "admin", "responsible", "person in charge", "penanggung jawab", "penanggung_jawab"],
    photo: ["foto_url", "photo_url", "photo", "foto", "image", "image_url", "unit photo", "unit_photo"]
  },
  statusGroups: {
    breakdown: ["breakdown", "bd", "b/d", "down", "repair", "rusak", "unscheduled"],
    ready: ["ready", "rfu", "available", "operational", "running", "standby", "stand by"],
    maintenance: ["maintenance", "mtc", "pm", "service", "scheduled"]
  }
};
