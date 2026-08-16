"""Decompress a CWS (zlib) SWF and dump its AS2 ActionConstantPool strings."""
import sys, zlib, struct, pathlib

def decompress(path):
    raw = pathlib.Path(path).read_bytes()
    sig = raw[:3]
    if sig == b'CWS':
        body = zlib.decompress(raw[8:])
    elif sig == b'FWS':
        body = raw[8:]
    else:
        raise SystemExit(f"unsupported signature {sig!r}")
    return raw[:8], body

def skip_rect(body):
    nbits = body[0] >> 3
    total_bits = 5 + nbits * 4
    return (total_bits + 7) // 8

def tags(body):
    off = skip_rect(body) + 4  # rect + framerate(2) + framecount(2)
    n = len(body)
    while off + 2 <= n:
        (code_len,) = struct.unpack_from('<H', body, off); off += 2
        code, length = code_len >> 6, code_len & 0x3F
        if length == 0x3F:
            (length,) = struct.unpack_from('<I', body, off); off += 4
        if off + length > n:
            break
        yield code, body[off:off+length]
        off += length
        if code == 0:
            break

def pools(data):
    """Walk an action block, yielding constant pools (tag 0x88)."""
    i, n = 0, len(data)
    out = []
    while i < n:
        code = data[i]; i += 1
        if code < 0x80:
            continue
        if i + 2 > n:
            break
        (length,) = struct.unpack_from('<H', data, i); i += 2
        payload = data[i:i+length]; i += length
        if code == 0x88 and len(payload) >= 2:
            (count,) = struct.unpack_from('<H', payload, 0)
            p, strs = 2, []
            for _ in range(count):
                e = payload.find(b'\x00', p)
                if e == -1:
                    break
                strs.append(payload[p:e].decode('utf-8', 'replace'))
                p = e + 1
            out.append(strs)
    return out

def main(path):
    _, body = decompress(path)
    all_strings, seen = [], set()
    counts = {}
    for code, data in tags(body):
        counts[code] = counts.get(code, 0) + 1
        if code in (12, 59, 39):  # DoAction, DoInitAction, DefineSprite
            blocks = [data]
            if code == 59:
                blocks = [data[2:]]
            if code == 39:
                continue
            for b in blocks:
                for pool in pools(b):
                    for s in pool:
                        if s and s not in seen:
                            seen.add(s)
                            all_strings.append(s)
    sys.stderr.write(f"tag histogram: {dict(sorted(counts.items()))}\n")
    sys.stderr.write(f"unique pool strings: {len(all_strings)}\n")
    for s in all_strings:
        print(s)

if __name__ == '__main__':
    main(sys.argv[1])
