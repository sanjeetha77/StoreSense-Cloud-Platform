import logging
import json
from opentelemetry import trace

from contextvars import ContextVar
from typing import Optional

request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
analysis_id_var: ContextVar[Optional[str]] = ContextVar("analysis_id", default=None)

class StructuredJsonFormatter(logging.Formatter):
    def format(self, record):
        # Format timestamp to ISO format with Z suffix
        timestamp = self.formatTime(record, "%Y-%m-%dT%H:%M:%S")
        if record.msecs:
            timestamp = f"{timestamp}.{int(record.msecs):03d}Z"
        else:
            timestamp = f"{timestamp}.000Z"

        log_data = {
            "timestamp": timestamp,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": "backend"
        }
        
        # Inject custom fields if they are supplied in extra
        if hasattr(record, "agent"):
            log_data["agent"] = record.agent
        if hasattr(record, "latency_ms"):
            log_data["latency_ms"] = record.latency_ms
        if hasattr(record, "status"):
            log_data["status"] = record.status
            
        # Try to correlate with Context Variables
        req_id = request_id_var.get()
        if req_id:
            log_data["request_id"] = req_id
            
        ana_id = analysis_id_var.get()
        if ana_id:
            log_data["analysis_id"] = ana_id
            
        # Try to correlate with OpenTelemetry Trace Context
        try:
            current_span = trace.get_current_span()
            if current_span and current_span.get_span_context().is_valid:
                log_data["trace_id"] = trace.format_trace_id(current_span.get_span_context().trace_id)
                log_data["span_id"] = trace.format_span_id(current_span.get_span_context().span_id)
        except Exception:
            pass
            
        # Capture error information
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_data)

def setup_logging():
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Remove existing logger handlers to prevent duplicate output
    for h in root_logger.handlers[:]:
        root_logger.removeHandler(h)
        
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredJsonFormatter())
    root_logger.addHandler(handler)
