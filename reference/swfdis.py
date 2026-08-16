"""Disassemble AS2 action blocks in a SWF into a readable linear token stream."""
import sys, zlib, struct, pathlib

OPS = {
    0x04:'NextFrame',0x06:'Play',0x07:'Stop',0x0A:'Add',0x0B:'Subtract',0x0C:'Multiply',
    0x0D:'Divide',0x0E:'Equals',0x0F:'Less',0x10:'And',0x11:'Or',0x12:'Not',
    0x13:'StringEquals',0x17:'Pop',0x18:'ToInteger',0x1C:'GetVariable',0x1D:'SetVariable',
    0x21:'StringAdd',0x22:'GetProperty',0x23:'SetProperty',0x24:'CloneSprite',
    0x28:'EndDrag',0x3A:'Delete',0x3B:'Delete2',0x3C:'DefineLocal',0x3D:'CallFunction',
    0x3E:'Return',0x3F:'Modulo',0x40:'NewObject',0x41:'DefineLocal2',0x42:'InitArray',
    0x43:'InitObject',0x44:'TypeOf',0x46:'Enumerate',0x47:'Add2',0x48:'Less2',
    0x49:'Equals2',0x4A:'ToNumber',0x4B:'ToString',0x4C:'PushDuplicate',0x4D:'StackSwap',
    0x4E:'GetMember',0x4F:'SetMember',0x50:'Increment',0x51:'Decrement',0x52:'CallMethod',
    0x53:'NewMethod',0x54:'InstanceOf',0x55:'Enumerate2',0x60:'BitAnd',0x61:'BitOr',
    0x62:'BitXor',0x63:'BitLShift',0x64:'BitRShift',0x65:'BitURShift',0x66:'StrictEquals',
    0x67:'Greater',0x69:'Extends',
}

def decompress(path):
    raw = pathlib.Path(path).read_bytes()
    if raw[:3] == b'CWS':
        return zlib.decompress(raw[8:])
    if raw[:3] == b'FWS':
        return raw[8:]
    raise SystemExit('unsupported sig')

def skip_rect(body):
    nbits = body[0] >> 3
    return ((5 + nbits * 4) + 7) // 8

def tags(body):
    off = skip_rect(body) + 4
    n = len(body)
    while off + 2 <= n:
        (cl,) = struct.unpack_from('<H', body, off); off += 2
        code, length = cl >> 6, cl & 0x3F
        if length == 0x3F:
            (length,) = struct.unpack_from('<I', body, off); off += 4
        if off + length > n:
            break
        yield code, body[off:off+length]
        off += length
        if code == 0:
            break

def fmt(v):
    if isinstance(v, str):
        s = v if len(v) <= 60 else v[:60] + '...'
        return '"' + s.replace('\n', '\\n').replace('\r', '\\r') + '"'
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)

def disasm(data, out):
    i, n, pool = 0, len(data), []
    while i < n:
        code = data[i]; i += 1
        if code == 0:
            continue
        if code < 0x80:
            out.append(OPS.get(code, f'op_{code:02X}'))
            continue
        if i + 2 > n:
            break
        (length,) = struct.unpack_from('<H', data, i); i += 2
        p = data[i:i+length]; i += length
        if code == 0x88:  # ConstantPool
            (cnt,) = struct.unpack_from('<H', p, 0)
            q, pool = 2, []
            for _ in range(cnt):
                e = p.find(b'\x00', q)
                if e == -1: break
                pool.append(p[q:e].decode('utf-8', 'replace')); q = e + 1
            out.append(f'ConstantPool[{len(pool)}]')
        elif code == 0x96:  # Push
            q = 0
            while q < len(p):
                t = p[q]; q += 1
                try:
                    if t == 0:
                        e = p.find(b'\x00', q)
                        val = p[q:e].decode('utf-8','replace'); q = e + 1
                    elif t == 1:
                        val = struct.unpack_from('<f', p, q)[0]; q += 4
                    elif t == 2: val = None
                    elif t == 3: val = 'undefined'
                    elif t == 4: val = f'reg{p[q]}'; q += 1
                    elif t == 5: val = bool(p[q]); q += 1
                    elif t == 6:
                        raw8 = p[q:q+8]; q += 8
                        val = struct.unpack('<d', raw8[4:] + raw8[:4])[0]
                    elif t == 7:
                        val = struct.unpack_from('<i', p, q)[0]; q += 4
                    elif t == 8:
                        i8 = p[q]; q += 1
                        val = pool[i8] if i8 < len(pool) else f'<c{i8}>'
                    elif t == 9:
                        i16 = struct.unpack_from('<H', p, q)[0]; q += 2
                        val = pool[i16] if i16 < len(pool) else f'<c{i16}>'
                    else:
                        break
                except Exception:
                    break
                out.append(f'PUSH {fmt(val)}')
        elif code == 0x87:
            out.append(f'StoreRegister {p[0]}')
        elif code == 0x9B:
            e = p.find(b'\x00'); name = p[:e].decode('utf-8','replace')
            out.append(f'--- DefineFunction "{name}" ---')
        elif code == 0x8E:
            e = p.find(b'\x00'); name = p[:e].decode('utf-8','replace')
            out.append(f'--- DefineFunction2 "{name}" ---')
        elif code == 0x99:
            out.append('Jump')
        elif code == 0x9D:
            out.append('If')
        elif code == 0x9F:
            out.append('GotoFrame2')
        elif code == 0x8B:
            out.append('SetTarget')
        else:
            out.append(f'act_{code:02X}[{length}]')
    return out

def sprite_tags(data):
    """DefineSprite: u16 id, u16 framecount, then a nested tag stream."""
    off, n = 4, len(data)
    while off + 2 <= n:
        (cl,) = struct.unpack_from('<H', data, off); off += 2
        code, length = cl >> 6, cl & 0x3F
        if length == 0x3F:
            (length,) = struct.unpack_from('<I', data, off); off += 4
        if off + length > n:
            break
        yield code, data[off:off+length]
        off += length
        if code == 0:
            break

def walk(code, data, out, ctx=''):
    if code == 12:
        out.append(f'===== DoAction {ctx} =====')
        disasm(data, out)
    elif code == 59:
        sid = struct.unpack_from('<H', data, 0)[0]
        out.append(f'===== DoInitAction sprite {sid} {ctx} =====')
        disasm(data[2:], out)
    elif code == 39:
        sid, frames = struct.unpack_from('<HH', data, 0)
        inner = [c for c, _ in sprite_tags(data)]
        if 12 in inner or 39 in inner:
            out.append(f'===== DefineSprite {sid} ({frames} frames) =====')
            for c, d in sprite_tags(data):
                walk(c, d, out, ctx=f'[sprite {sid}]')

def main(path):
    body = decompress(path)
    out = []
    for code, data in tags(body):
        walk(code, data, out)
    print('\n'.join(out))

if __name__ == '__main__':
    main(sys.argv[1])
