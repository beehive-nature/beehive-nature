//! The CANDIDATE implementation: SurrealKV 1.0 as an embedded in-process
//! engine — never SurrealDB Server (NO-SERVER-DB ruling). Durability is
//! `Immediate`, set on EVERY transaction (SurrealKV's default is Eventual —
//! the adapter exists to make that default unreachable through this seam).
//! The engine's commit is async; this adapter drives it on a private
//! current-thread runtime so the seam itself stays synchronous and
//! engine-neutral.

use std::path::{Path, PathBuf};

use ::surrealkv::{Durability, LSMIterator, ReadOptions, Tree, TreeBuilder};

use crate::{
    prefix_upper, DurabilityMode as SeamDurability, Edit, EmbeddedStore, Result, StoreError,
};

pub struct SurrealKvStore {
    tree: Tree,
    path: PathBuf,
    rt: tokio::runtime::Runtime,
}

/// Path-only constructor — there is no server to point at.
pub fn open(path: &Path) -> Result<SurrealKvStore> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    // Runtime FIRST: SurrealKV 1.0's build() is sync-signatured but
    // spawns background tasks internally, which requires an entered
    // Tokio context — building outside any runtime panics.
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| StoreError::Corrupt {
            detail: format!("runtime build: {e}"),
        })?;
    let tree = {
        let _enter = rt.enter();
        TreeBuilder::new()
            .with_path(path.to_path_buf())
            .build()
            .map_err(StoreError::from)?
    };
    Ok(SurrealKvStore {
        tree,
        path: path.to_path_buf(),
        rt,
    })
}

impl EmbeddedStore for SurrealKvStore {
    fn engine(&self) -> &'static str {
        "surrealkv/candidate-1.0"
    }

    fn durability_mode(&self) -> SeamDurability {
        // Durability is pinned per transaction in write_batch — the only
        // write path through this seam. There is no open() call that could
        // leave Eventual reachable.
        SeamDurability::Immediate
    }

    fn write_batch(&self, batch: &[Edit]) -> Result<()> {
        let _enter = self.rt.enter();
        if batch.is_empty() {
            return Ok(());
        }
        let mut tx = self.tree.begin()?;
        // The pin: SurrealKV defaults to Eventual; every write through the
        // seam carries Immediate. (Read-back is impossible on 1.0 — there
        // is no getter — so the crash test is the evidence, per L5.)
        tx.set_durability(Durability::Immediate);
        for edit in batch {
            match edit {
                Edit::Put(k, v) => tx.set(k.clone(), v.clone())?,
                Edit::Delete(k) => tx.delete(k.clone())?,
            }
        }
        self.rt.block_on(async { tx.commit().await })?;
        Ok(())
    }

    fn get(&self, key: &[u8]) -> Result<Option<Vec<u8>>> {
        let _enter = self.rt.enter();
        let mut tx = self.tree.begin()?;
        let v = tx.get(key.to_vec());
        tx.rollback();
        v.map_err(StoreError::from)
    }

    fn scan_prefix(&self, prefix: &[u8]) -> Result<Vec<(Vec<u8>, Vec<u8>)>> {
        let _enter = self.rt.enter();
        let mut tx = self.tree.begin()?;
        let mut out = Vec::new();
        match prefix_upper(prefix) {
            Some(upper) => {
                let mut it = tx.range(prefix.to_vec(), upper)?;
                it.seek_first()?;
                while it.valid() {
                    let k = it.key().user_key().to_vec();
                    let v = it.value()?;
                    out.push((k, v));
                    it.next()?;
                }
            }
            None => {
                let mut opts = ReadOptions::new();
                opts.set_iterate_lower_bound(Some(prefix.to_vec()));
                let mut it = tx.range_with_options(&opts)?;
                it.seek_first()?;
                while it.valid() {
                    let k = it.key().user_key().to_vec();
                    let v = it.value()?;
                    out.push((k, v));
                    it.next()?;
                }
            }
        }
        tx.rollback();
        Ok(out)
    }

    fn integrity_check(&self) -> Result<()> {
        let _enter = self.rt.enter();
        // Engine-side structural walk of the on-disk state (manifest +
        // levels), from surrealkv::inspect. Success = Ok; the deep CRC
        // scrub is a later beat if the API grows one.
        ::surrealkv::inspect::inspect_db(&self.path).map_err(StoreError::from)?;
        Ok(())
    }
}

impl Drop for SurrealKvStore {
    fn drop(&mut self) {
        // Best-effort graceful close; the crash test deliberately never
        // reaches this path.
        let tree = &self.tree;
        let _ = self.rt.block_on(async { tree.close().await });
    }
}
