"""Manda un push de prueba a los dispositivos registrados y muestra la respuesta de Expo.

Uso (desde backend/, con el .env cargado y la base arriba):

    python scripts/send_test_push.py --list                    # tokens registrados
    python scripts/send_test_push.py                           # a todos los dispositivos
    python scripts/send_test_push.py --user alan               # username o email
    python scripts/send_test_push.py --token "ExponentPushToken[xxx]"   # sin tocar la base

A diferencia de `send_expo_push`, aquí se imprimen los tickets (y los recibos de
entrega con --receipts) para poder diagnosticar por qué no llega un aviso.
"""
import argparse
import json
import sys
import time

import httpx

sys.path.insert(0, ".")

EXPO_SEND = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS = "https://exp.host/--/api/v2/push/getReceipts"


def tokens_from_db(user: str | None, list_only: bool) -> list[str]:
    from sqlalchemy import or_

    from app.core.database.models import DeviceToken, User
    from app.core.database.session import SessionLocal

    db = SessionLocal()
    try:
        query = db.query(DeviceToken, User).join(User, User.id == DeviceToken.user_id)
        if user:
            ident = user.strip().removeprefix("@")
            query = query.filter(or_(User.username == ident, User.email == ident))
        rows = query.order_by(DeviceToken.updated_at.desc()).all()
        if not rows:
            print("No hay dispositivos registrados"
                  + (f" para '{user}'." if user else "."))
            print("→ Inicia sesión en la app (dispositivo físico) y acepta el permiso.")
            return []
        for device, owner in rows:
            print(f"  {owner.username:<20} {device.platform or '?':<8} {device.token}")
        return [] if list_only else [d.token for d, _ in rows]
    finally:
        db.close()


def main() -> int:
    # La consola de Windows (cp1252) no imprime ✓ ✗ →.
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--user", help="username o email del destinatario")
    parser.add_argument("--token", help="token Expo concreto (omite la base de datos)")
    parser.add_argument("--list", action="store_true", help="solo lista los tokens")
    parser.add_argument("--title", default="Prueba UMLForge")
    parser.add_argument("--body", default="Si ves esto, el push funciona.")
    parser.add_argument("--receipts", action="store_true",
                        help="espera y consulta los recibos de entrega")
    args = parser.parse_args()

    tokens = [args.token] if args.token else tokens_from_db(args.user, args.list)
    if not tokens:
        return 0 if args.list else 1

    messages = [
        {"to": t, "title": args.title, "body": args.body,
         "data": {"type": "TEST"}, "sound": "default", "channelId": "default"}
        for t in tokens
    ]
    print(f"\nEnviando {len(messages)} mensaje(s) a Expo...")
    try:
        res = httpx.post(EXPO_SEND, json=messages, timeout=15.0)
    except httpx.HTTPError as exc:
        print(f"✗ No se pudo contactar con exp.host: {exc}")
        print("→ Revisa la salida a internet de esta máquina/servidor.")
        return 1
    if res.status_code != 200:
        print(f"✗ Expo respondió {res.status_code}: {res.text[:300]}")
        return 1

    ticket_ids: list[str] = []
    failed = False
    for token, ticket in zip(tokens, res.json().get("data", [])):
        if ticket.get("status") == "ok":
            print(f"✓ ticket ok   {token}  (id {ticket.get('id')})")
            ticket_ids.append(ticket["id"])
        else:
            failed = True
            code = (ticket.get("details") or {}).get("error", "?")
            print(f"✗ ticket error {token}: {code} — {ticket.get('message')}")
            if code == "DeviceNotRegistered":
                print("  → token inválido (app desinstalada o token viejo).")

    if args.receipts and ticket_ids:
        print("\nEsperando 15 s para consultar los recibos de entrega...")
        time.sleep(15)
        rec = httpx.post(EXPO_RECEIPTS, json={"ids": ticket_ids}, timeout=15.0)
        print(json.dumps(rec.json().get("data", rec.json()), indent=2, ensure_ascii=False))
        print("→ 'status: ok' = entregado a FCM/APNs. Si dice "
              "InvalidCredentials, revisa google-services.json / credenciales FCM.")
    elif ticket_ids:
        print("\nTicket ok = Expo aceptó el envío. Si no te llega al teléfono, "
              "vuelve a correr con --receipts: casi siempre es FCM mal configurado.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
