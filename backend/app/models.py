from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=True)  
    avatar = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="viewer")
    must_change_password = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    dashboards = relationship("Dashboard", back_populates="user")


class ZabbixServer(Base):
    __tablename__ = "zabbix_servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    api_url = Column(String(500), nullable=False)
    api_token_encrypted = Column(String(500), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    dashboards = relationship("Dashboard", back_populates="zabbix_server", cascade="all, delete-orphan")


class Dashboard(Base):
    __tablename__ = "dashboards"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    zabbix_server_id = Column(Integer, ForeignKey("zabbix_servers.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    in_rotation = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    rotation_interval = Column(Integer, nullable=True)
    update_interval = Column(Integer, default=30)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    panels = relationship("Panel", back_populates="dashboard", cascade="all, delete-orphan")
    zabbix_server = relationship("ZabbixServer", back_populates="dashboards")
    user = relationship("User", back_populates="dashboards")


class Panel(Base):
    __tablename__ = "panels"

    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    panel_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    position = Column(Integer, default=0)
    size = Column(Integer, default=1)
    config = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)

    dashboard = relationship("Dashboard", back_populates="panels")


class ScheduledNotification(Base):
    __tablename__ = "scheduled_notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    scheduled_at = Column(DateTime, nullable=False, index=True)
    notification_type = Column(String(20), default="notification")
    is_active = Column(Boolean, default=True)
    is_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)
    
    sender = relationship("User", foreign_keys=[sender_id], backref="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], backref="received_messages")