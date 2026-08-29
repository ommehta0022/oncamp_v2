import ota_updates


def test_expo_signature_uses_structured_field_string_not_byte_sequence():
    header = ota_updates._manifest_headers("AbC+/123==")["expo-signature"]
    assert header.startswith('sig="AbC+/123=="')
    assert 'sig=:' not in header
    assert 'keyid="oncampus-main"' in header
    assert 'alg="rsa-v1_5-sha256"' in header


def test_expo_signature_header_matches_android_stringitem_contract():
    header = ota_updates._manifest_headers("signature-value")["expo-signature"]
    fields = [part.strip() for part in header.split(",")]
    assert fields[0] == 'sig="signature-value"'
    assert fields[1].startswith('keyid="') and fields[1].endswith('"')
    assert fields[2] == 'alg="rsa-v1_5-sha256"'
