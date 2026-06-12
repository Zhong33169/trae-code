from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from datetime import timedelta

from apps.auth.models import User
from apps.applications.models import Application, ApplicationMaterial, AuditLog


class Command(BaseCommand):
    help = "创建演示数据"

    def handle(self, *args, **options):
        self.stdout.write("开始创建演示数据...")

        users_data = [
            {"username": "zhangwei", "password": "123456", "role": "community_worker", "display_name": "张伟(社区专干)"},
            {"username": "lina", "password": "123456", "role": "clerk", "display_name": "李娜(街道科员)"},
            {"username": "wangqiang", "password": "123456", "role": "leader", "display_name": "王强(分管领导)"},
        ]

        users = {}
        for ud in users_data:
            user, created = User.objects.get_or_create(
                username=ud["username"],
                defaults={
                    "password": make_password(ud["password"]),
                    "role": ud["role"],
                    "display_name": ud["display_name"],
                    "is_active": True,
                },
            )
            users[ud["role"]] = user
            if created:
                self.stdout.write(f"  创建用户: {ud['display_name']}")
            else:
                self.stdout.write(f"  用户已存在: {ud['display_name']}")

        now = timezone.now()
        applications_data = [
            {
                "application_no": "BF20260001",
                "creator": users["community_worker"],
                "applicant_name": "赵大爷",
                "applicant_id_card": "110101194501011234",
                "difficulty_type": "medical",
                "difficulty_description": "患有严重心脏病，长期服药，经济困难",
                "assistance_amount": 5000.00,
                "status": "pending_verify",
                "submitted_at": now - timedelta(days=2),
                "deadline": now + timedelta(days=5),
            },
            {
                "application_no": "BF20260002",
                "creator": users["community_worker"],
                "applicant_name": "刘阿姨",
                "applicant_id_card": "110101195502022345",
                "difficulty_type": "low_income",
                "difficulty_description": "丧偶独居，无固定收入来源，生活困难",
                "assistance_amount": 3000.00,
                "status": "pending_approve",
                "submitted_at": now - timedelta(days=5),
                "verified_at": now - timedelta(days=3),
                "deadline": now + timedelta(days=2),
            },
            {
                "application_no": "BF20260003",
                "creator": users["community_worker"],
                "applicant_name": "孙师傅",
                "applicant_id_card": "110101197003033456",
                "difficulty_type": "disability",
                "difficulty_description": "因工伤致残，丧失劳动能力",
                "assistance_amount": 8000.00,
                "status": "approved",
                "submitted_at": now - timedelta(days=10),
                "verified_at": now - timedelta(days=8),
                "approved_at": now - timedelta(days=5),
                "deadline": now - timedelta(days=3),
            },
            {
                "application_no": "BF20260004",
                "creator": users["community_worker"],
                "applicant_name": "周女士",
                "applicant_id_card": "110101198504044567",
                "difficulty_type": "disaster",
                "difficulty_description": "家庭遭受火灾，房屋及财物严重受损",
                "assistance_amount": 10000.00,
                "status": "draft",
                "deadline": now + timedelta(days=7),
            },
            {
                "application_no": "BF20260005",
                "creator": users["community_worker"],
                "applicant_name": "吴同学",
                "applicant_id_card": "110101200505055678",
                "difficulty_type": "other",
                "difficulty_description": "父母双亡，在校大学生，学费困难",
                "assistance_amount": 4000.00,
                "status": "rejected",
                "submitted_at": now - timedelta(days=8),
                "verified_at": now - timedelta(days=6),
                "deadline": now - timedelta(days=1),
            },
        ]

        for app_data in applications_data:
            app, created = Application.objects.get_or_create(
                application_no=app_data["application_no"],
                defaults=app_data,
            )
            if created:
                self.stdout.write(f"  创建申请: {app.application_no} - {app.applicant_name} ({app.get_status_display()})")

                if app.status != "draft":
                    ApplicationMaterial.objects.create(
                        application=app,
                        stage="application",
                        file_name=f"{app.applicant_name}_申请表.pdf",
                        file_path=f"uploads/{app.application_no}/申请表.pdf",
                        material_type="申请表",
                    )

                if app.status in ("pending_approve", "approved", "rejected"):
                    ApplicationMaterial.objects.create(
                        application=app,
                        stage="verification",
                        file_name=f"{app.applicant_name}_核验报告.pdf",
                        file_path=f"uploads/{app.application_no}/核验报告.pdf",
                        material_type="核验报告",
                    )

                if app.status == "approved":
                    ApplicationMaterial.objects.create(
                        application=app,
                        stage="approval",
                        file_name=f"{app.applicant_name}_审批意见.pdf",
                        file_path=f"uploads/{app.application_no}/审批意见.pdf",
                        material_type="审批意见",
                    )

                if app.status == "draft":
                    AuditLog.objects.create(
                        application=app,
                        operator=app.creator,
                        action="create",
                        from_status="",
                        to_status="draft",
                        opinion="创建申请",
                    )
                elif app.status == "pending_verify":
                    AuditLog.objects.create(
                        application=app,
                        operator=app.creator,
                        action="submit",
                        from_status="draft",
                        to_status="pending_verify",
                        opinion="提交申请",
                    )
                elif app.status == "pending_approve":
                    AuditLog.objects.create(
                        application=app,
                        operator=app.creator,
                        action="submit",
                        from_status="draft",
                        to_status="pending_verify",
                        opinion="提交申请",
                    )
                    AuditLog.objects.create(
                        application=app,
                        operator=users["clerk"],
                        action="verify",
                        from_status="pending_verify",
                        to_status="pending_approve",
                        opinion="材料齐全，情况属实，建议通过",
                    )
                elif app.status == "approved":
                    AuditLog.objects.create(
                        application=app,
                        operator=app.creator,
                        action="submit",
                        from_status="draft",
                        to_status="pending_verify",
                        opinion="提交申请",
                    )
                    AuditLog.objects.create(
                        application=app,
                        operator=users["clerk"],
                        action="verify",
                        from_status="pending_verify",
                        to_status="pending_approve",
                        opinion="材料齐全，情况属实",
                    )
                    AuditLog.objects.create(
                        application=app,
                        operator=users["leader"],
                        action="approve",
                        from_status="pending_approve",
                        to_status="approved",
                        opinion="同意帮扶",
                    )
                elif app.status == "rejected":
                    AuditLog.objects.create(
                        application=app,
                        operator=app.creator,
                        action="submit",
                        from_status="draft",
                        to_status="pending_verify",
                        opinion="提交申请",
                    )
                    AuditLog.objects.create(
                        application=app,
                        operator=users["clerk"],
                        action="verify",
                        from_status="pending_verify",
                        to_status="pending_approve",
                        opinion="核验通过",
                    )
                    AuditLog.objects.create(
                        application=app,
                        operator=users["leader"],
                        action="reject",
                        from_status="pending_approve",
                        to_status="rejected",
                        opinion="不符合帮扶条件",
                    )
            else:
                self.stdout.write(f"  申请已存在: {app.application_no}")

        self.stdout.write(self.style.SUCCESS("演示数据创建完成!"))
