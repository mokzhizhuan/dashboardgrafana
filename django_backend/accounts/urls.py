from django.urls import path
from .views import login_view, main_dashboard_options, register_view

urlpatterns = [
    path("login/", login_view, name="login"),
    path("register/", register_view, name="register"),
    path("options/", main_dashboard_options, name="main_dashboard_options"),
]