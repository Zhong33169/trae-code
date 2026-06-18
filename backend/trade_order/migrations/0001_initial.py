from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("sales", "外贸业务员"), ("doc_supervisor", "单证主管"), ("biz_manager", "业务经理")], max_length=30, verbose_name="角色")),
                ("display_name", models.CharField(max_length=100, verbose_name="显示名称")),
                ("phone", models.CharField(blank=True, max_length=50, verbose_name="联系电话")),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="profile", to="auth.user", verbose_name="用户")),
            ],
            options={"verbose_name": "用户资料", "verbose_name_plural": "用户资料"},
        ),
        migrations.CreateModel(
            name="TradeOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order_no", models.CharField(max_length=50, unique=True, verbose_name="订单编号")),
                ("customer_name", models.CharField(max_length=200, verbose_name="客户名称")),
                ("country", models.CharField(max_length=100, verbose_name="目的国")),
                ("product_name", models.CharField(max_length=200, verbose_name="产品名称")),
                ("quantity", models.DecimalField(decimal_places=2, max_digits=15, verbose_name="数量")),
                ("unit", models.CharField(default="PCS", max_length=20, verbose_name="单位")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=18, verbose_name="订单金额(USD)")),
                ("currency", models.CharField(default="USD", max_length=10, verbose_name="币种")),
                ("status", models.CharField(choices=[("draft", "草稿"), ("pending_doc", "待单证处理"), ("doc_processing", "单证处理中"), ("doc_exception", "单证异常"), ("doc_correction", "待业务员补正"), ("pending_confirm", "待业务经理确认"), ("confirm_exception", "确认异常"), ("confirm_correction", "待单证补正"), ("completed", "已完成"), ("rejected", "已退回")], default="draft", max_length=30, verbose_name="状态")),
                ("version", models.IntegerField(default=1, verbose_name="版本号(乐观锁)")),
                ("sales_remark", models.TextField(blank=True, verbose_name="业务员备注")),
                ("doc_remark", models.TextField(blank=True, verbose_name="单证主管备注")),
                ("confirm_remark", models.TextField(blank=True, verbose_name="业务经理备注")),
                ("exception_remark", models.TextField(blank=True, verbose_name="异常说明")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="创建时间")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="更新时间")),
                ("submitted_at", models.DateTimeField(blank=True, null=True, verbose_name="提交时间")),
                ("doc_processed_at", models.DateTimeField(blank=True, null=True, verbose_name="单证处理时间")),
                ("confirmed_at", models.DateTimeField(blank=True, null=True, verbose_name="确认完成时间")),
                ("confirm_handler", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="confirm_orders", to="auth.user", verbose_name="确认人(经理)")),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_orders", to="auth.user", verbose_name="创建人(业务员)")),
                ("doc_handler", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="doc_orders", to="auth.user", verbose_name="单证处理人")),
            ],
            options={"verbose_name": "外贸订单", "verbose_name_plural": "外贸订单", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="OrderHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(max_length=100, verbose_name="操作动作")),
                ("from_status", models.CharField(blank=True, max_length=30, verbose_name="原状态")),
                ("to_status", models.CharField(blank=True, max_length=30, verbose_name="新状态")),
                ("remark", models.TextField(blank=True, verbose_name="备注")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="操作时间")),
                ("operator", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="order_histories", to="auth.user", verbose_name="操作人")),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="histories", to="trade_order.tradeorder", verbose_name="订单")),
            ],
            options={"verbose_name": "订单历史", "verbose_name_plural": "订单历史", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="OrderEvidence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("evidence_type", models.CharField(choices=[("inquiry", "客户询盘"), ("quotation", "报价确认"), ("contract", "订单签订")], max_length=20, verbose_name="证据类型")),
                ("file_name", models.CharField(max_length=255, verbose_name="文件名称")),
                ("file_url", models.URLField(verbose_name="文件地址/链接")),
                ("remark", models.CharField(blank=True, max_length=500, verbose_name="备注")),
                ("uploaded_at", models.DateTimeField(auto_now_add=True, verbose_name="上传时间")),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="evidences", to="trade_order.tradeorder", verbose_name="订单")),
                ("uploader", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="uploaded_evidences", to="auth.user", verbose_name="上传人")),
            ],
            options={"verbose_name": "订单证据", "verbose_name_plural": "订单证据", "ordering": ["-uploaded_at"]},
        ),
        migrations.CreateModel(
            name="BatchOperation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("batch_no", models.CharField(max_length=50, unique=True, verbose_name="批处理编号")),
                ("action", models.CharField(choices=[("submit_to_doc", "提交单证处理"), ("approve_doc", "单证复核通过"), ("reject_doc", "单证退回补正"), ("mark_exception_doc", "单证标记异常"), ("submit_to_confirm", "提交经理确认"), ("approve_confirm", "经理确认通过"), ("reject_confirm", "经理退回补正"), ("mark_exception_confirm", "确认标记异常")], max_length=40, verbose_name="批操作类型")),
                ("status", models.CharField(choices=[("pending", "待执行"), ("running", "执行中"), ("completed", "已完成"), ("failed", "执行失败")], default="pending", max_length=20, verbose_name="批处理状态")),
                ("total_count", models.IntegerField(default=0, verbose_name="总条数")),
                ("success_count", models.IntegerField(default=0, verbose_name="成功条数")),
                ("failed_count", models.IntegerField(default=0, verbose_name="失败条数")),
                ("retry_count", models.IntegerField(default=0, verbose_name="需重试条数")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="创建时间")),
                ("started_at", models.DateTimeField(blank=True, null=True, verbose_name="开始时间")),
                ("finished_at", models.DateTimeField(blank=True, null=True, verbose_name="完成时间")),
                ("remark", models.TextField(blank=True, verbose_name="备注")),
                ("operator", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="batch_operations", to="auth.user", verbose_name="操作人")),
            ],
            options={"verbose_name": "批处理操作", "verbose_name_plural": "批处理操作", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="BatchOperationItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_status", models.CharField(choices=[("success", "成功"), ("failed", "失败"), ("retry", "需重试")], max_length=20, verbose_name="处理结果")),
                ("error_code", models.CharField(blank=True, max_length=50, verbose_name="错误码")),
                ("error_message", models.TextField(blank=True, verbose_name="错误/结果说明")),
                ("processed_at", models.DateTimeField(blank=True, null=True, verbose_name="处理时间")),
                ("batch", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="trade_order.batchoperation", verbose_name="批处理")),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="batch_items", to="trade_order.tradeorder", verbose_name="订单")),
            ],
            options={"verbose_name": "批处理明细", "verbose_name_plural": "批处理明细", "ordering": ["id"]},
        ),
    ]
