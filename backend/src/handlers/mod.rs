use actix_web::web;

mod auth;
mod inspection;
mod handover;
mod stats;
mod logs;
mod reminder;
mod corporate;
mod users;

pub fn auth_handlers() -> actix_web::Scope {
    web::scope("/auth")
        .route("/login", web::post().to(auth::login))
        .route("/me", web::get().to(auth::me))
}

pub fn inspection_handlers() -> actix_web::Scope {
    web::scope("/forms")
        .route("", web::get().to(inspection::list_forms))
        .route("", web::post().to(inspection::create_form))
        .route("/{id}", web::get().to(inspection::get_form))
        .route("/{id}", web::put().to(inspection::update_form))
        .route("/{id}/submit", web::post().to(inspection::submit_form))
        .route("/{id}/audit", web::post().to(inspection::audit_form))
        .route("/{id}/review", web::post().to(inspection::review_form))
}

pub fn handover_handlers() -> actix_web::Scope {
    web::scope("/handovers")
        .route("/{id}/confirm", web::post().to(handover::confirm_handover))
        .route("/form/{form_id}", web::get().to(handover::list_handovers))
}

pub fn stats_handlers() -> actix_web::Scope {
    web::scope("/stats")
        .route("", web::get().to(stats::get_stats))
}

pub fn log_handlers() -> actix_web::Scope {
    web::scope("/logs")
        .route("", web::get().to(logs::list_logs))
}

pub fn reminder_handlers() -> actix_web::Scope {
    web::scope("/reminders")
        .route("", web::get().to(reminder::list_reminders))
}

pub fn corporate_handlers() -> actix_web::Scope {
    web::scope("/corporates")
        .route("", web::get().to(corporate::list_corporates))
}

pub fn user_handlers() -> actix_web::Scope {
    web::scope("/users")
        .route("", web::get().to(users::list_users))
}
