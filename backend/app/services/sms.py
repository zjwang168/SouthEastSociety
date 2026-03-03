def send_sms(phone_number: str, message: str) -> bool:
    """
    MVP stub for SMS sending.
    Later replace with Twilio / other SMS provider.
    """
    print(f"[SMS] to={phone_number} | message={message}")
    return True