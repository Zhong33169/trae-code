use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    DatabaseError(String),
    #[error("业务错误: {0}")]
    BusinessError(String),
    #[error("未找到: {0}")]
    NotFound(String),
}
