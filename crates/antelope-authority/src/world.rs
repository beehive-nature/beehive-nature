//! The permission table, the link table and the chain configuration the
//! checker reads: a pure in-memory world, built by the corpus, consulted
//! through the same lookups the chain performs.

use crate::authority::Authority;
use crate::name::{Name, PermissionLevel};
use crate::Refusal;
use std::collections::BTreeMap;

/// The two configuration rows the authorization path reads
/// (`authorization_manager.cpp:491,501`), with the defaults the chain ships.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct ChainConfig {
    /// `config.hpp:80`: `default_max_auth_depth = 6`.
    pub max_authority_depth: u16,
    /// `config.hpp:77`: `default_max_trx_delay = 45*24*3600` seconds.
    pub max_transaction_delay: u32,
}

impl Default for ChainConfig {
    fn default() -> ChainConfig {
        ChainConfig {
            max_authority_depth: 6,
            max_transaction_delay: 45 * 24 * 3600,
        }
    }
}

/// One `permission_object` (`permission_object.hpp:25-35`): owner, name,
/// parent (None for the root, which is the chain's `parent._id == 0`,
/// `permission_object.hpp:61`), authority.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Permission {
    pub owner: Name,
    pub name: Name,
    pub parent: Option<Name>,
    pub auth: Authority,
}

impl Permission {
    pub fn level(&self) -> PermissionLevel {
        PermissionLevel::new(self.owner.clone(), self.name.clone())
    }
}

/// `config.hpp:22,33-35`.
pub fn system_account() -> Name {
    Name::parse("eosio").unwrap()
}
pub fn active_name() -> Name {
    Name::parse("active").unwrap()
}
pub fn owner_name() -> Name {
    Name::parse("owner").unwrap()
}
pub fn eosio_any_name() -> Name {
    Name::parse("eosio.any").unwrap()
}

/// The five native actions `lookup_minimum_permission` refuses to resolve
/// (`authorization_manager.cpp:307-315`) and `check_authorization`
/// special-cases on their action data (`:514-530`). This model carries no
/// action data, so it REFUSES them by name rather than answering.
pub fn native_authority_actions() -> [Name; 5] {
    [
        Name::parse("updateauth").unwrap(),
        Name::parse("deleteauth").unwrap(),
        Name::parse("linkauth").unwrap(),
        Name::parse("unlinkauth").unwrap(),
        Name::parse("canceldelay").unwrap(),
    ]
}

#[derive(Clone, Debug, Default)]
pub struct World {
    permissions: BTreeMap<(Name, Name), Permission>,
    /// `permission_link_object` keyed `(account, code, message_type)`
    /// (`authorization_manager.cpp:285-291`); an empty `message_type` is the
    /// contract-wide default link.
    links: BTreeMap<(Name, Name, Name), Name>,
    pub config: ChainConfig,
}

impl World {
    pub fn new() -> World {
        World::default()
    }

    pub fn with_config(config: ChainConfig) -> World {
        World {
            config,
            ..World::default()
        }
    }

    /// The `newaccount` shape: `owner` as the root permission and `active`
    /// as its child (`authorization_manager.cpp:146-216` creates both).
    pub fn add_account(
        &mut self,
        account: &Name,
        owner: Authority,
        active: Authority,
    ) -> Result<(), Refusal> {
        if self.permissions.keys().any(|(o, _)| o == account) {
            return Err(Refusal::AccountExists(account.clone()));
        }
        self.insert(account, &owner_name(), None, owner)?;
        self.insert(account, &active_name(), Some(&owner_name()), active)?;
        Ok(())
    }

    /// The `updateauth` shape for a new permission: the parent must already
    /// exist under the same owner; the authority must validate.
    pub fn add_permission(
        &mut self,
        owner: &Name,
        name: &Name,
        parent: &Name,
        auth: Authority,
    ) -> Result<(), Refusal> {
        if self
            .find_permission(&PermissionLevel::new(owner.clone(), parent.clone()))
            .is_none()
        {
            return Err(Refusal::UnknownParent {
                owner: owner.clone(),
                parent: parent.clone(),
            });
        }
        self.insert(owner, name, Some(parent), auth)
    }

    fn insert(
        &mut self,
        owner: &Name,
        name: &Name,
        parent: Option<&Name>,
        auth: Authority,
    ) -> Result<(), Refusal> {
        let level = PermissionLevel::new(owner.clone(), name.clone());
        if owner.is_empty() || name.is_empty() {
            return Err(Refusal::InvalidPermissionLevel);
        }
        if let Err(e) = auth.validate() {
            return Err(Refusal::AuthorityInvalid(level, e));
        }
        if self
            .permissions
            .contains_key(&(owner.clone(), name.clone()))
        {
            return Err(Refusal::DuplicatePermission(level));
        }
        self.permissions.insert(
            (owner.clone(), name.clone()),
            Permission {
                owner: owner.clone(),
                name: name.clone(),
                parent: parent.cloned(),
                auth,
            },
        );
        Ok(())
    }

    /// The `linkauth` shape: `(account, code, action)` maps to `permission`;
    /// `action` None links the whole contract. The target must be a
    /// permission of the account, or `eosio.any`.
    pub fn link(
        &mut self,
        account: &Name,
        code: &Name,
        action: Option<&Name>,
        permission: &Name,
    ) -> Result<(), Refusal> {
        let target = PermissionLevel::new(account.clone(), permission.clone());
        if *permission != eosio_any_name() && self.find_permission(&target).is_none() {
            return Err(Refusal::LinkTargetUnknown(target));
        }
        let act = action.cloned().unwrap_or_else(Name::empty);
        self.links
            .insert((account.clone(), code.clone(), act), permission.clone());
        Ok(())
    }

    /// `find_permission` (`authorization_manager.cpp:266-270`): None when
    /// absent. The chain throws on an empty actor or permission; the one
    /// caller that swallows that throw is the tally visitor (`:229-235`),
    /// which this crate mirrors at the call site.
    pub fn find_permission(&self, level: &PermissionLevel) -> Option<&Permission> {
        self.permissions
            .get(&(level.actor.clone(), level.permission.clone()))
    }

    /// `get_permission` (`authorization_manager.cpp:272-276`).
    pub fn get_permission(&self, level: &PermissionLevel) -> Result<&Permission, Refusal> {
        if level.actor.is_empty() || level.permission.is_empty() {
            return Err(Refusal::InvalidPermissionLevel);
        }
        self.find_permission(level)
            .ok_or_else(|| Refusal::UnknownPermission(level.clone()))
    }

    /// `permission_object::satisfies` (`permission_object.hpp:47-67`): does
    /// `this` equal `other`, or sit above it in the parent chain of `other`?
    /// Different owners never satisfy each other.
    pub fn satisfies(
        &self,
        this: &PermissionLevel,
        other: &PermissionLevel,
    ) -> Result<bool, Refusal> {
        let me = self.get_permission(this)?;
        let mut cur = self.get_permission(other)?;
        if me.owner != cur.owner {
            return Ok(false);
        }
        if me.name == cur.name {
            return Ok(true);
        }
        let mut hops = 0usize;
        while let Some(parent) = &cur.parent {
            if *parent == me.name {
                return Ok(true);
            }
            cur = self.get_permission(&PermissionLevel::new(cur.owner.clone(), parent.clone()))?;
            hops += 1;
            if hops > self.permissions.len() {
                // a parent cycle cannot exist on the chain (parents are
                // assigned at creation from existing rows); refuse rather
                // than loop if a corpus ever builds one
                return Err(Refusal::ParentCycle(other.clone()));
            }
        }
        Ok(false)
    }

    /// `lookup_linked_permission` (`authorization_manager.cpp:278-299`): the
    /// action-specific link, else the contract-wide link, else None.
    pub fn lookup_linked_permission(
        &self,
        authorizer: &Name,
        scope: &Name,
        act_name: &Name,
    ) -> Option<Name> {
        if let Some(p) = self
            .links
            .get(&(authorizer.clone(), scope.clone(), act_name.clone()))
        {
            return Some(p.clone());
        }
        self.links
            .get(&(authorizer.clone(), scope.clone(), Name::empty()))
            .cloned()
    }

    /// `lookup_minimum_permission` (`authorization_manager.cpp:301-327`):
    /// refuses the five native authority actions by name; no link means
    /// `active`; a link to `eosio.any` means no minimum (Ok(None)); else the
    /// linked name.
    pub fn lookup_minimum_permission(
        &self,
        authorizer: &Name,
        scope: &Name,
        act_name: &Name,
    ) -> Result<Option<Name>, Refusal> {
        if *scope == system_account() && native_authority_actions().contains(act_name) {
            return Err(Refusal::NativeAuthorityActionNotModeled(act_name.clone()));
        }
        match self.lookup_linked_permission(authorizer, scope, act_name) {
            None => Ok(Some(active_name())),
            Some(p) if p == eosio_any_name() => Ok(None),
            Some(p) => Ok(Some(p)),
        }
    }

    pub fn permission_count(&self) -> usize {
        self.permissions.len()
    }
}
