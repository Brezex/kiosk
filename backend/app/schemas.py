from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ============ Auth ============
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    must_change_password: bool
    created_at: datetime 

    class Config:
        from_attributes = True


# ============ Zabbix Servers ============
class ZabbixServerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    api_url: str = Field(min_length=1)
    api_token: str = Field(min_length=1)
    is_active: bool = True


class ZabbixServerUpdate(BaseModel):
    name: Optional[str] = None
    api_url: Optional[str] = None
    api_token: Optional[str] = None
    is_active: Optional[bool] = None


class ZabbixServerResponse(BaseModel):
    id: int
    name: str
    api_url: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ZabbixServerTestResult(BaseModel):
    success: bool
    version: Optional[str] = None
    error: Optional[str] = None


# ============ Zabbix Proxy Requests ============
class ZabbixHostsRequest(BaseModel):
    server_id: int
    search: Optional[str] = None


class ZabbixItemsRequest(BaseModel):
    server_id: int
    host_id: str
    search: Optional[str] = None


class ZabbixHistoryRequest(BaseModel):
    server_id: int
    item_ids: List[str]
    period: str = "1h"
    limit: int = 1000


class ZabbixProblemsRequest(BaseModel):
    server_id: int
    recent: bool = True
    limit: int = 100


# ============ Dashboards ============
class DashboardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    zabbix_server_id: Optional[int] = None
    in_rotation: bool = True
    sort_order: int = 0
    rotation_interval: Optional[int] = None


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    zabbix_server_id: Optional[int] = None
    in_rotation: Optional[bool] = None
    sort_order: Optional[int] = None
    rotation_interval: Optional[int] = None


class DashboardResponse(BaseModel):
    id: int
    name: str
    zabbix_server_id: Optional[int]
    in_rotation: bool
    sort_order: int
    rotation_interval: Optional[int]
    created_at: datetime
    panels: List["PanelResponse"] = [] 
    zabbix_server: Optional["ZabbixServerResponse"] = None  #

    class Config:
        from_attributes = True


# ============ Panels ============
class PanelCreate(BaseModel):
    panel_type: str = Field(pattern="^(chart|single_value|table|text|matrix)$")
    title: str = Field(min_length=1, max_length=200)
    position: int = Field(ge=0, default=0)
    size: int = Field(ge=1, le=2, default=1)
    config: Dict[str, Any] = {}


class PanelUpdate(BaseModel):
    panel_type: Optional[str] = None
    title: Optional[str] = None
    position: Optional[int] = None
    size: Optional[int] = None
    config: Optional[Dict[str, Any]] = None


from pydantic import field_validator
import json

class PanelResponse(BaseModel):
    id: int
    dashboard_id: int
    panel_type: str
    title: str
    position: int
    size: int
    config: Dict[str, Any]
    created_at: datetime

    @field_validator('config', mode='before')
    @classmethod
    def parse_config(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    class Config:
        from_attributes = True


# ============ Kiosk ============
class KioskPanel(BaseModel):
    id: int
    panel_type: str
    title: str
    position: int
    size: int
    config: Dict[str, Any]


class KioskDashboard(BaseModel):
    id: int
    name: str
    zabbix_server_id: Optional[int]
    rotation_interval: Optional[int]
    panels: List[KioskPanel]


class Notification(BaseModel):
    id: str
    host_name: str
    problem_name: str
    severity: str
    time: str
    status: str


class KioskState(BaseModel):
    dashboards: List[KioskDashboard]
    notifications: List[Notification]
    zabbix_connected: bool
    global_rotation_interval: int


# ============ Scheduled Notifications ============
class ScheduledNotificationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1)
    scheduled_at: datetime
    notification_type: str = Field(default="notification", pattern="^(notification|reminder)$")
    is_active: bool = True


class ScheduledNotificationUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    notification_type: Optional[str] = None
    is_active: Optional[bool] = None


class ScheduledNotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    scheduled_at: datetime
    notification_type: str
    is_active: bool
    is_sent: bool
    created_at: datetime

    class Config:
        from_attributes = True

        from typing import Optional

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "viewer"
    must_change_password: bool = True


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    must_change_password: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    must_change_password: bool
    created_at: datetime  # ← datetime!

    class Config:
        from_attributes = True

        from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "viewer"
    must_change_password: bool = True


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    must_change_password: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    must_change_password: bool
    created_at: datetime

    class Config:
        from_attributes = True