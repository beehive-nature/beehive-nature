//! The canonical byte form of every journal record: a version tag, then
//! fields, each length-prefixed. Decoding is strict — a short read, a bad tag,
//! trailing bytes or a non-UTF-8 string is `Corrupt`, never a guess.

use crate::digest::Digest32;
use crate::Refusal;

pub const VERSION: u8 = 1;

#[derive(Default)]
pub struct Enc(Vec<u8>);

impl Enc {
    pub fn new(kind: u8) -> Self {
        Enc(vec![VERSION, kind])
    }
    pub fn u8(mut self, v: u8) -> Self {
        self.0.push(v);
        self
    }
    pub fn u64(mut self, v: u64) -> Self {
        self.0.extend_from_slice(&v.to_be_bytes());
        self
    }
    pub fn i64(mut self, v: i64) -> Self {
        self.0.extend_from_slice(&v.to_be_bytes());
        self
    }
    pub fn bytes(mut self, v: &[u8]) -> Self {
        self.0.extend_from_slice(&(v.len() as u32).to_be_bytes());
        self.0.extend_from_slice(v);
        self
    }
    pub fn str(self, v: &str) -> Self {
        self.bytes(v.as_bytes())
    }
    pub fn digest(mut self, d: &Digest32) -> Self {
        self.0.extend_from_slice(&d.0);
        self
    }
    pub fn strs(mut self, v: &[String]) -> Self {
        self.0.extend_from_slice(&(v.len() as u32).to_be_bytes());
        for s in v {
            self = self.str(s);
        }
        self
    }
    pub fn opt_u64(self, v: Option<u64>) -> Self {
        match v {
            None => self.u8(0),
            Some(x) => self.u8(1).u64(x),
        }
    }
    pub fn done(self) -> Vec<u8> {
        self.0
    }
}

pub struct Dec<'a> {
    buf: &'a [u8],
    at: usize,
}

fn corrupt(what: &str) -> Refusal {
    Refusal::Corrupt(format!("record decode: {what}"))
}

impl<'a> Dec<'a> {
    /// Open a record, checking the version and returning its kind byte.
    pub fn open(buf: &'a [u8]) -> Result<(u8, Dec<'a>), Refusal> {
        if buf.len() < 2 {
            return Err(corrupt("short header"));
        }
        if buf[0] != VERSION {
            return Err(corrupt("unknown record version"));
        }
        Ok((buf[1], Dec { buf, at: 2 }))
    }
    fn take(&mut self, n: usize) -> Result<&'a [u8], Refusal> {
        let end = self.at.checked_add(n).ok_or_else(|| corrupt("overflow"))?;
        if end > self.buf.len() {
            return Err(corrupt("short read"));
        }
        let s = &self.buf[self.at..end];
        self.at = end;
        Ok(s)
    }
    pub fn u8(&mut self) -> Result<u8, Refusal> {
        Ok(self.take(1)?[0])
    }
    pub fn u64(&mut self) -> Result<u64, Refusal> {
        Ok(u64::from_be_bytes(self.take(8)?.try_into().unwrap()))
    }
    pub fn i64(&mut self) -> Result<i64, Refusal> {
        Ok(i64::from_be_bytes(self.take(8)?.try_into().unwrap()))
    }
    pub fn bytes(&mut self) -> Result<Vec<u8>, Refusal> {
        let n = u32::from_be_bytes(self.take(4)?.try_into().unwrap()) as usize;
        Ok(self.take(n)?.to_vec())
    }
    pub fn str(&mut self) -> Result<String, Refusal> {
        String::from_utf8(self.bytes()?).map_err(|_| corrupt("non-UTF-8 string"))
    }
    pub fn digest(&mut self) -> Result<Digest32, Refusal> {
        Ok(Digest32(self.take(32)?.try_into().unwrap()))
    }
    pub fn strs(&mut self) -> Result<Vec<String>, Refusal> {
        let n = u32::from_be_bytes(self.take(4)?.try_into().unwrap()) as usize;
        // a count larger than the remaining bytes could hold is corrupt, not an
        // allocation request
        if n > self.buf.len() - self.at {
            return Err(corrupt("string count exceeds record"));
        }
        (0..n).map(|_| self.str()).collect()
    }
    pub fn opt_u64(&mut self) -> Result<Option<u64>, Refusal> {
        match self.u8()? {
            0 => Ok(None),
            1 => Ok(Some(self.u64()?)),
            _ => Err(corrupt("option tag")),
        }
    }
    pub fn end(self) -> Result<(), Refusal> {
        if self.at != self.buf.len() {
            return Err(corrupt("trailing bytes"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_and_strict_end() {
        let d = crate::digest::hash("t", &[b"x"]);
        let b = Enc::new(7)
            .u64(9)
            .str("hé")
            .digest(&d)
            .strs(&["a".into(), "".into()])
            .opt_u64(None)
            .opt_u64(Some(3))
            .i64(-2)
            .done();
        let (k, mut r) = Dec::open(&b).unwrap();
        assert_eq!(k, 7);
        assert_eq!(r.u64().unwrap(), 9);
        assert_eq!(r.str().unwrap(), "hé");
        assert_eq!(r.digest().unwrap(), d);
        assert_eq!(r.strs().unwrap(), vec!["a".to_string(), "".to_string()]);
        assert_eq!(r.opt_u64().unwrap(), None);
        assert_eq!(r.opt_u64().unwrap(), Some(3));
        assert_eq!(r.i64().unwrap(), -2);
        r.end().unwrap();

        let mut extra = b.clone();
        extra.push(0);
        let (_, mut r) = Dec::open(&extra).unwrap();
        r.u64().unwrap();
        r.str().unwrap();
        r.digest().unwrap();
        r.strs().unwrap();
        r.opt_u64().unwrap();
        r.opt_u64().unwrap();
        r.i64().unwrap();
        assert!(r.end().is_err(), "trailing byte refused");

        for cut in 0..b.len() {
            let res = (|| {
                let (_, mut r) = Dec::open(&b[..cut])?;
                r.u64()?;
                r.str()?;
                r.digest()?;
                r.strs()?;
                r.opt_u64()?;
                r.opt_u64()?;
                r.i64()?;
                r.end()
            })();
            assert!(res.is_err(), "truncation at {cut} refused");
        }
    }
}
