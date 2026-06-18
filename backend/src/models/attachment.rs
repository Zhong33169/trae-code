use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Attachment {
    pub id: String,
    pub material_id: String,
    pub file_name: String,
    pub file_type: Option<String>,
    pub file_size: i64,
    pub uploaded_by: String,
    pub uploaded_by_name: Option<String>,
    pub uploaded_at: String,
    pub is_required: bool,
    pub status: String,
    pub reject_reason: Option<String>,
    pub rejected_by: Option<String>,
    pub rejected_by_name: Option<String>,
    pub rejected_at: Option<String>,
    pub replaces_attachment_id: Option<String>,
    pub replaces_file_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddAttachmentRequest {
    pub file_name: String,
    pub file_type: Option<String>,
    pub file_size: Option<i64>,
    pub is_required: Option<bool>,
    pub operator_id: String,
    pub replaces_attachment_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RejectAttachmentRequest {
    pub reject_reason: String,
    pub operator_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ValidateAttachmentRequest {
    pub operator_id: String,
}

pub fn attachment_status_name(s: &str) -> &'static str {
    match s {
        "valid" => "有效",
        "rejected" => "被驳回",
        "removed" => "已移除",
        _ => "未知",
    }
}

pub fn has_required_attachments(attachments: &[Attachment]) -> bool {
    let required: Vec<&Attachment> = attachments.iter().filter(|a| a.is_required).collect();
    if required.is_empty() {
        return true;
    }
    required.iter().all(|a| {
        if a.status == "valid" {
            return true;
        }
        if a.status == "rejected" {
            return attachments.iter().any(|r| r.replaces_attachment_id.as_deref() == Some(&a.id) && r.status == "valid");
        }
        false
    })
}

pub fn missing_required_count(attachments: &[Attachment]) -> usize {
    attachments
        .iter()
        .filter(|a| a.is_required && a.status != "valid" && !attachments.iter().any(|r| r.replaces_attachment_id.as_deref() == Some(&a.id) && r.status == "valid"))
        .count()
}

pub fn get_rejected_without_replacement(attachments: &[Attachment]) -> Vec<&Attachment> {
    attachments
        .iter()
        .filter(|a| a.is_required && a.status == "rejected" && !attachments.iter().any(|r| r.replaces_attachment_id.as_deref() == Some(&a.id) && r.status == "valid"))
        .collect()
}

pub fn get_replacements_for<'a>(attachments: &'a [Attachment], att_id: &str) -> Vec<&'a Attachment> {
    attachments
        .iter()
        .filter(|a| a.replaces_attachment_id.as_deref() == Some(att_id))
        .collect()
}
