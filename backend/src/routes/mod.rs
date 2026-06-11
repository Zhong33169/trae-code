use crate::db::DbPool;
use crate::handlers as h;
use crate::models::*;
use poem::web::Data;
use poem_openapi::{
    param::{Path, Query, Header},
    payload::Json,
    ApiResponse, Object, OpenApi, Tags,
};

#[derive(Tags)]
enum ApiTags {
    Auth,
    Tickets,
    Handover,
    Logs,
    Statistics,
    Users,
}

#[derive(ApiResponse)]
enum ErrorResponse {
    #[oai(status = 400)]
    BadRequest(Json<ErrorMsg>),
    #[oai(status = 401)]
    Unauthorized(Json<ErrorMsg>),
    #[oai(status = 403)]
    Forbidden(Json<ErrorMsg>),
    #[oai(status = 404)]
    NotFound(Json<ErrorMsg>),
    #[oai(status = 500)]
    InternalError(Json<ErrorMsg>),
}

#[derive(Object, Debug, Clone)]
struct ErrorMsg {
    message: String,
}

impl From<anyhow::Error> for ErrorResponse {
    fn from(err: anyhow::Error) -> Self {
        ErrorResponse::BadRequest(Json(ErrorMsg {
            message: err.to_string(),
        }))
    }
}

pub struct Api;

#[OpenApi]
impl Api {
    #[oai(path = "/auth/login", method = "post", tag = "ApiTags::Auth")]
    async fn login(
        &self,
        pool: Data<&DbPool>,
        req: Json<LoginRequest>,
    ) -> Result<Json<LoginResponse>, ErrorResponse> {
        let result = h::login(pool.0, req.0).await
            .map_err(|e| ErrorResponse::from(e))?;
        Ok(Json(result))
    }

    #[oai(path = "/tickets", method = "get", tag = "ApiTags::Tickets")]
    async fn list_tickets(
        &self,
        pool: Data<&DbPool>,
        token: Header<String>,
        status: Query<Option<String>>,
        page: Query<Option<i64>>,
        page_size: Query<Option<i64>>,
    ) -> Result<Json<TicketListResponse>, ErrorResponse> {
        let current_user = self.get_user_from_token(pool.0, &token.0).await?;
        let page = page.unwrap_or(1);
        let page_size = page_size.unwrap_or(20);
        let result = h::list_tickets(pool.0, &current_user, status.0, page, page_size).await
            .map_err(|e| ErrorResponse::from(e))?;
        Ok(Json(result))
    }

    #[oai(path = "/tickets/:id", method = "get", tag = "ApiTags::Tickets")]
    async fn get_ticket(
        &self,
        pool: Data<&DbPool>,
        token: Header<String>,
        id: Path<String>,
    ) -> Result<Json<TicketDetail>, ErrorResponse> {
        let current_user = self.get_user_from_token(pool.0, &token.0).await?;
        let result = h::get_ticket_detail(pool.0, &id.0, &current_user).await
            .map_err(|e| ErrorResponse::from(e))?;
        Ok(Json(result))
    }

    #[oai(path = "/tickets", method = "post", tag = "ApiTags::Tickets")]
    async fn create_ticket(
        &self,
        pool: Data<&DbPool>,
        token: Header<String>,
        req: Json<CreateTicketRequest>,
    ) -> Result<Json<Ticket>, ErrorResponse> {
        let current_user = self.get_user_from_token(pool.0, &token.0).await?;
        if current_user.role != "agent" {
            return Err(ErrorResponse::Forbidden(Json(ErrorMsg {
                message: "只有客服坐席可以创建工单".to_string(),
            })));
        }
        let result = h::create_ticket(pool.0, req.0, &current_user).await
            .map_err(|e| ErrorResponse::from(e))?;
        Ok(Json(result))
    }

    #[oai(path = "/tickets/:id/status", method = "put", tag = "ApiTags::Tickets")]
    async fn update_ticket_status(
        &self,
        pool: Data<&DbPool>,
        token: Header<String>,
        id: Path<String>,
        req: Json<UpdateTicketStatusRequest>,
    ) -> Result<Json<Ticket>, ErrorResponse> {
        let current_user = self.get_user_from_token(pool.0, &token.0).await?;
        let result = h::update_ticket_status(pool.0, &id.0, req.0, &current_user).await
            .map_err(|e| ErrorResponse::from(e))?;
        Ok(Json(result))
    }

    #[oai(path = "/handover", method = "post", tag = "ApiTags::Handover")]
    async fn create_handover(
        &self,
        pool: Data<&DbPool>,
        token: Header<String>,
        req: Json<CreateHandoverRequest>,
    ) -> Result<Json<HandoverRecord>, ErrorResponse> {
        let current_user = self.get_user_from_token(pool.0, &token.0).await?;
        let result = h::create_handover(pool.0, req.0, &current_user).await
            .map_err(|e| ErrorResponse::from(e))?;
        Ok(Json(result))
    }

    #[oai(path = "/handover/:id/accept", method = "post", tag = "ApiTags::Handover")]
    async fn accept_handover(
        &self,
        pool: Data<&DbPool>,
        token: Header<String>,
        id: Path<String>,
    ) -> Result<Json<HandoverRecord>, ErrorResponse> {
        let current_user = self.get_user_from_token(pool.0, &token.0).await?;
        let result = h::accept_handover(pool.0, &id.0, &current_user).await
            .map_err(|e| ErrorResponse::from(e))?;
        Ok(Json(result))
    }

    #[oai(path = "/handover/:id/reject", method = "post", tag = "ApiTags::Handover")]
    async fn reject_handover(
        &self,
        pool: Data<&DbPool>,
        token: Header<String>,
        id: Path<String>,
        req: Json<HandoverActionRequest>,
    ) -> Result<Json<HandoverRecord>, ErrorResponse> {
        let current_user = self.get_user_from_token(pool.0, &token.0).await?;
        let result = h::reject_handover(pool.0, &id.0, req.0, &current_user).await
            .map_err(|e| ErrorResponse::from(e))?;
        Ok(Json(result))
    }

    #[oai(path = "/handover/my", method = "get", tag = "ApiTags::Handover")]
    async fn list_my_handovers(
        &self,
        pool: Data<&DbPool>,
        token: Header<String>,
        status: Query<Option<String>>,
    ) -> Result<Json<Vec<HandoverRecordDetail>>, ErrorResponse> {
        let current_user = self.get_user_from_token(pool.0, &token.0).await?;
        let result = h::list_my_handovers(pool.0, &current_user, status.0).await
            .map_err(|e| ErrorResponse::from(e))?;
        Ok(Json(result))
    }

    #[oai(path = "/logs", method = "get", tag = "ApiTags::Logs")]
    async fn get_operation_logs(
        &self,
        pool: Data<&DbPool>,
        token: Header<String>,
        ticket_id: Query<Option<String>>,
    ) -> Result<Json<Vec<OperationLogDetail>>, ErrorResponse> {
        let current_user = self.get_user_from_token(pool.0, &token.0).await?;
        let result = h::get_operation_logs(pool.0, ticket_id.0.as_deref(), &current_user).await
            .map_err(|e| ErrorResponse::from(e))?;
        Ok(Json(result))
    }

    #[oai(path = "/statistics", method = "get", tag = "ApiTags::Statistics")]
    async fn get_statistics(
        &self,
        pool: Data<&DbPool>,
        token: Header<String>,
    ) -> Result<Json<StatisticsResponse>, ErrorResponse> {
        let current_user = self.get_user_from_token(pool.0, &token.0).await?;
        let result = h::get_statistics(pool.0, &current_user).await
            .map_err(|e| ErrorResponse::from(e))?;
        Ok(Json(result))
    }

    #[oai(path = "/users/qa-managers", method = "get", tag = "ApiTags::Users")]
    async fn get_qa_managers(
        &self,
        pool: Data<&DbPool>,
        token: Header<String>,
    ) -> Result<Json<Vec<UserInfo>>, ErrorResponse> {
        let _current_user = self.get_user_from_token(pool.0, &token.0).await?;
        let users = h::get_users_by_role(pool.0, "qa_manager").await
            .map_err(|e| ErrorResponse::from(e))?;
        let result: Vec<UserInfo> = users.into_iter().map(UserInfo::from).collect();
        Ok(Json(result))
    }

    #[oai(path = "/users/cs-managers", method = "get", tag = "ApiTags::Users")]
    async fn get_cs_managers(
        &self,
        pool: Data<&DbPool>,
        token: Header<String>,
    ) -> Result<Json<Vec<UserInfo>>, ErrorResponse> {
        let _current_user = self.get_user_from_token(pool.0, &token.0).await?;
        let users = h::get_users_by_role(pool.0, "cs_manager").await
            .map_err(|e| ErrorResponse::from(e))?;
        let result: Vec<UserInfo> = users.into_iter().map(UserInfo::from).collect();
        Ok(Json(result))
    }
}

impl Api {
    async fn get_user_from_token(&self, pool: &DbPool, token: &str) -> Result<User, ErrorResponse> {
        if !token.starts_with("token_") {
            return Err(ErrorResponse::Unauthorized(Json(ErrorMsg {
                message: "无效的 token".to_string(),
            })));
        }

        let user_id = &token[6..];
        match h::get_user_by_id(pool, user_id).await {
            Ok(user) => Ok(user),
            Err(_) => Err(ErrorResponse::Unauthorized(Json(ErrorMsg {
                message: "用户不存在".to_string(),
            }))),
        }
    }
}
