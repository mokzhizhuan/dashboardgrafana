from django.contrib import admin
from django.urls import path
from accounts.views import (
    health,
    main_dashboard_options,
    get_telemetry,
    export_dashboard_csv,
    add_telemetry,
    me_view,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("auth/me/", me_view, name="me_view"),
    path("main-dashboard/options/", main_dashboard_options, name="main_dashboard_options"),
    path("telemetry/", get_telemetry, name="get_telemetry"),
    path("telemetry/add/", add_telemetry, name="add_telemetry"),
    path("export/dashboard_csv/", export_dashboard_csv, name="export_dashboard_csv"),
]