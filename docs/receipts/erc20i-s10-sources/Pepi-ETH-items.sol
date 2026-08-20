//https://twitter.com/Pepi_ERC20i
//https://t.me/pepe_ERC20i
//https://pepe-erc20i.vip/

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./Erc20.sol";
import "./PoolCreatableErc20i.sol";
import "./IHasItemsWithRoe.sol";
import "../Generator.sol";

library ExtraSeedLibrary {
    function extra(
        address account,
        uint extraSeed
    ) internal pure returns (uint256) {
        return uint(keccak256(abi.encodePacked(account, extraSeed)));
    }
}

abstract contract HasItemsWithRoe is PoolCreatableErc20i, IHasItemsWithRoe {
    using ExtraSeedLibrary for address;

    error ItemNotFound();
    error TransferFromZero();
    error TransferToZero();
    error TransferAmountExceedsBalance();
    error UnknownValue();
    error NotOwnerOfItems();
    error ItemValueMismatch();
    error NotStarted();
    error MaxBuyLimit();

    uint internal constant _VALUE_LVL_1 = 1;
    uint internal constant _VALUE_LVL_2 = 2;
    uint internal constant _VALUE_LVL_3 = 4;
    uint internal constant _VALUE_LVL_4 = 6;
    uint internal constant _VALUE_LVL_5 = 8;
    /// @dev Max new items minted per incoming transfer from source; remainder becomes roe.
    uint internal constant _MAX_NEW_ITEMS_PER_INCOMING = 1000;
    uint8 internal constant _BURN_REASON_TO_SOURCE = 1;
    uint8 internal constant _BURN_REASON_INVARIANT = 2;
    uint8 internal constant _BURN_REASON_SOURCE_SANITIZE = 3;
    uint8 internal constant _BURN_REASON_PARTIAL_ROE = 4;

    mapping(address owner => uint) _itemCounts;
    mapping(address owner => mapping(uint index => uint itemId)) _ownedTokenIds;
    mapping(address owner => mapping(uint itemId => uint index))
        _ownedTokenIndexes;
    mapping(address owner => mapping(uint itemId => SeedData seed_data))
        _ownedTokens;
    mapping(address owner => mapping(uint itemId => bool)) _owns;
    mapping(address owner => mapping(uint value => uint[] itemIds))
        _ownedValueItemIds;
    mapping(address owner => mapping(uint itemId => uint valueIndex))
        _ownedValueItemIndexes;
    mapping(address owner => uint totalValue) _itemValueTotals;
    mapping(address owner => SeedData roe_data) _roe;

    mapping(uint index => address user) _holderList;
    mapping(address user => uint index) _holderListIndexes;
    mapping(address user => bool exists) _holderExists;
    mapping(address addr => bool isItemSource) _itemSources;

    uint _itemsTotalCount;
    uint _holdersCount;
    uint _roeTotalCount;
    uint _nextItemId = 1;
    uint _random_nonce;

    constructor() PoolCreatableErc20i("PEPi", "PEPI", msg.sender) {}

    function tokenUnit() external pure returns (uint256) {
        return _tokenUnit();
    }

    function isItemSource(address addr) public view returns (bool) {
        return _isItemSource(addr);
    }

    function isSeedSource(address addr) public view returns (bool) {
        return isItemSource(addr);
    }

    function _isItemSource(address addr) internal virtual view returns (bool) {
        return _itemSources[addr];
    }

    function _setItemSource(address addr, bool value) internal {
        _itemSources[addr] = value;
        if (value) {
            _sanitizeSourceAccount(addr);
        } else {
            _syncRoe(addr);
            _syncHolder(addr);
        }
    }

    function _sanitizeSourceAccount(address account) internal {
        _burnAllItems(account, _BURN_REASON_SOURCE_SANITIZE);
        _syncRoe(account);
        _syncHolder(account);
    }

    function _handleTransferState(
        address from,
        address to,
        uint256 amount,
        uint roeFrom,
        bool mintFromSource
    ) internal {
        if (from == address(this)) {
            return;
        }

        if (amount > roeFrom) {
            uint needToFreeRaw = amount - roeFrom;
            uint itemIdExact = _tryExactValueItem(from, amount);
            if (itemIdExact != 0) {
                // Special rule for value=1: when transferring 1 token between non-sources
                // we treat it as pure roe instead of a separate lvl1 item — the item is burned
                // and the receiver gets roe=1.
                if (amount == _tokenUnit() * _VALUE_LVL_1) {
                    SeedData memory burned = _removeItemFromOwner(from, itemIdExact);
                    emit OnItemBurn(from, itemIdExact, burned.value, _BURN_REASON_PARTIAL_ROE);
                } else {
                    // For other values (2, 4, 6, 8), the exact amount moves one item (LIFO within the value bucket).
                    _moveOneItem(from, to, itemIdExact);
                }
            } else {
                _freeItemsFromEndOfList(from, to, needToFreeRaw);
            }
        }

        if (
            mintFromSource &&
            to != address(0) &&
            !_isItemSource(to) &&
            amount >= _tokenUnit()
        ) {
            _mintItemsFromIncoming(to, amount / _tokenUnit());
        }

        _enforceInvariant(from);
        _enforceInvariant(to);
    }

    /// @dev If amountRaw equals a constant value (V * tokenUnit) and owner has such item, returns item id from end of that value bucket; else 0.
    function _tryExactValueItem(
        address owner,
        uint amountRaw
    ) internal view returns (uint) {
        uint unit = _tokenUnit();
        if (amountRaw == unit * _VALUE_LVL_1) return _getLastOwnerItemIdByValue(owner, _VALUE_LVL_1);
        if (amountRaw == unit * _VALUE_LVL_2) return _getLastOwnerItemIdByValue(owner, _VALUE_LVL_2);
        if (amountRaw == unit * _VALUE_LVL_3) return _getLastOwnerItemIdByValue(owner, _VALUE_LVL_3);
        if (amountRaw == unit * _VALUE_LVL_4) return _getLastOwnerItemIdByValue(owner, _VALUE_LVL_4);
        if (amountRaw == unit * _VALUE_LVL_5) return _getLastOwnerItemIdByValue(owner, _VALUE_LVL_5);
        return 0;
    }

    function _moveOneItem(address from, address to, uint itemId) internal {
        SeedData memory moved = _removeItemFromOwner(from, itemId);
        if (_isItemSource(to) || to == address(0)) {
            emit OnItemBurn(from, itemId, moved.value, _BURN_REASON_TO_SOURCE);
        } else {
            _addItemToOwnerWithId(to, moved, itemId);
            emit OnItemTransfer(from, to, itemId, moved);
        }
    }

    /// @dev Free needToFreeRaw (raw units) by moving or burning items from the end of owner's index list.
    function _freeItemsFromEndOfList(
        address from,
        address to,
        uint needToFreeRaw
    ) internal {
        uint unit = _tokenUnit();
        while (needToFreeRaw > 0 && _itemCounts[from] > 0) {
            uint index = _itemCounts[from] - 1;
            uint itemId = _ownedTokenIds[from][index];
            SeedData memory data = _ownedTokens[from][itemId];
            uint V = data.value;
            uint V_raw = V * unit;

            _removeItemFromOwner(from, itemId);

            if (V_raw <= needToFreeRaw) {
                needToFreeRaw -= V_raw;
                if (_isItemSource(to) || to == address(0)) {
                    emit OnItemBurn(from, itemId, V, _BURN_REASON_TO_SOURCE);
                } else {
                    _addItemToOwnerWithId(to, data, itemId);
                    emit OnItemTransfer(from, to, itemId, data);
                }
            } else {
                emit OnItemBurn(from, itemId, V, _BURN_REASON_PARTIAL_ROE);
                needToFreeRaw = 0;
            }
        }
    }

    function _mintItemsFromIncoming(address account, uint incoming) internal {
        if (incoming == 0 || _isItemSource(account)) return;
        uint remains = incoming;
        uint before = _itemCounts[account];
        unchecked {
            for (uint v = 5; v >= 1; --v) {
                uint val = v == 5 ? _VALUE_LVL_5 : v == 4 ? _VALUE_LVL_4 : v == 3 ? _VALUE_LVL_3 : v == 2 ? _VALUE_LVL_2 : _VALUE_LVL_1;
                if (remains < val) continue;
                uint n = _itemCounts[account] - before;
                if (n >= _MAX_NEW_ITEMS_PER_INCOMING) break;
                uint count = remains / val;
                if (val <= _VALUE_LVL_2) {
                    if (n != 0) break;
                    if (val == _VALUE_LVL_1 && count > 1) count = 1;
                } else {
                    uint cap = _MAX_NEW_ITEMS_PER_INCOMING - n;
                    if (count > cap) count = cap;
                }
                for (uint i = 0; i < count; ++i) _mintItem(account, val);
                remains -= count * val;
            }
        }
    }

    /// @dev Maps item value (1/2/4/6/8) to generator level 1-5. Same as former Generator lvl1Value..lvl5Value logic.
    function _valueToItemLvl(uint value) internal pure returns (uint8) {
        if (value == _VALUE_LVL_1) return 1;
        if (value == _VALUE_LVL_2) return 2;
        if (value == _VALUE_LVL_3) return 3;
        if (value == _VALUE_LVL_4) return 4;
        if (value == _VALUE_LVL_5) return 5;
        return 0;
    }

    function _mintItem(address to, uint value) internal {
        if (_isItemSource(to)) return;
        SeedData memory data = SeedData({
            lvl: _valueToItemLvl(value),
            value: value,
            seed1: RandLib.random_value(++_random_nonce),
            seed2: to.extra(++_random_nonce)
        });
        uint itemId = _nextItemId++;
        _addItemToOwnerWithId(to, data, itemId);
        emit OnItemMint(to, itemId, value, data);
    }

    function _tokenUnit() internal pure returns (uint) {
        return 10 ** uint(_decimals);
    }

    function _enforceInvariant(address account) internal {
        if (account == address(0) || account == address(this)) return;
        if (_isItemSource(account)) {
            _sanitizeSourceAccount(account);
            return;
        }

        uint balanceRaw = _balances[account];
        uint itemTotalRaw = _itemValueTotals[account] * _tokenUnit();
        while (itemTotalRaw > balanceRaw) {
            uint itemId = _selectItemIdForInvariantBurn(account);
            if (itemId == 0) break;
            SeedData memory burned = _removeItemFromOwner(account, itemId);
            emit OnItemBurn(
                account,
                itemId,
                burned.value,
                _BURN_REASON_INVARIANT
            );
        }
        _syncRoe(account);
        _syncHolder(account);
    }

    function _selectItemIdForInvariantBurn(
        address owner
    ) internal view returns (uint) {
        if (_itemCounts[owner] == 0) return 0;
        return _ownedTokenIds[owner][_itemCounts[owner] - 1];
    }

    function _targetRoe(address account) internal view returns (uint) {
        if (account == address(0) || account == address(this) || _isItemSource(account))
            return 0;
        uint balanceRaw = _balances[account];
        uint itemTotalRaw = _itemValueTotals[account] * _tokenUnit();
        if (balanceRaw <= itemTotalRaw) return 0;
        return balanceRaw - itemTotalRaw;
    }

    function _syncRoe(address account) internal {
        if (account == address(0) || account == address(this)) return;
        uint oldRoe = _roe[account].value;
        uint newRoe = _targetRoe(account);
        if (oldRoe == newRoe) return;

        if (oldRoe == 0 && newRoe > 0) ++_roeTotalCount;
        if (oldRoe > 0 && newRoe == 0 && _roeTotalCount > 0) --_roeTotalCount;

        _roe[account].lvl = 0;
        _roe[account].value = newRoe;
        _roe[account].seed1 = RandLib.random_value(++_random_nonce);
        _roe[account].seed2 = account.extra(++_random_nonce);

        if (newRoe > oldRoe) {
            emit OnRoeGrow(account, _roe[account]);
        } else {
            emit OnRoeShrink(account, _roe[account]);
        }
    }

    function _isHolder(address account) internal view returns (bool) {
        if (
            account == address(0) || account == address(this) || _isItemSource(account)
        ) return false;
        return _itemCounts[account] > 0 || _roe[account].value > 0;
    }

    function _syncHolder(address account) internal {
        if (account == address(0) || account == address(this)) return;
        bool shouldHold = _isHolder(account);
        bool exists = _holderExists[account];
        if (shouldHold && !exists) {
            _holderExists[account] = true;
            _holderList[_holdersCount] = account;
            _holderListIndexes[account] = _holdersCount;
            ++_holdersCount;
            return;
        }

        if (!shouldHold && exists) {
            uint removingIndex = _holderListIndexes[account];
            uint lastIndex = _holdersCount - 1;
            if (removingIndex != lastIndex) {
                address lastHolder = _holderList[lastIndex];
                _holderList[removingIndex] = lastHolder;
                _holderListIndexes[lastHolder] = removingIndex;
            }
            delete _holderList[lastIndex];
            delete _holderListIndexes[account];
            _holderExists[account] = false;
            --_holdersCount;
        }
    }

    function _addItemToOwnerWithId(
        address to,
        SeedData memory data,
        uint itemId
    ) internal {
        if (_isItemSource(to)) return;
        uint length = _itemCounts[to];
        _ownedTokenIds[to][length] = itemId;
        _ownedTokenIndexes[to][itemId] = length;
        _ownedTokens[to][itemId] = data;
        _owns[to][itemId] = true;
        _ownedValueItemIndexes[to][itemId] = _ownedValueItemIds[to][data.value]
            .length;
        _ownedValueItemIds[to][data.value].push(itemId);
        _itemValueTotals[to] += data.value;
        ++_itemCounts[to];
        ++_itemsTotalCount;
    }

    function _removeItemFromOwner(
        address owner,
        uint itemId
    ) internal returns (SeedData memory data) {
        data = _ownedTokens[owner][itemId];
        if (data.value == 0) revert ItemNotFound();

        uint tokenIndex = _ownedTokenIndexes[owner][itemId];
        uint lastTokenIndex = _itemCounts[owner] - 1;
        uint lastItemId = _ownedTokenIds[owner][lastTokenIndex];
        if (tokenIndex != lastTokenIndex) {
            _ownedTokenIds[owner][tokenIndex] = lastItemId;
            _ownedTokenIndexes[owner][lastItemId] = tokenIndex;
        }
        delete _ownedTokenIds[owner][lastTokenIndex];
        delete _ownedTokenIndexes[owner][itemId];
        delete _ownedTokens[owner][itemId];
        _owns[owner][itemId] = false;

        _removeOwnedValueItemId(owner, data.value, itemId);
        _itemValueTotals[owner] -= data.value;
        --_itemCounts[owner];
        if (_itemsTotalCount > 0) --_itemsTotalCount;
    }

    function _burnAllItems(address owner, uint8 reason) internal {
        while (_itemCounts[owner] > 0) {
            uint itemId = _ownedTokenIds[owner][_itemCounts[owner] - 1];
            SeedData memory burned = _removeItemFromOwner(owner, itemId);
            emit OnItemBurn(owner, itemId, burned.value, reason);
        }
    }

    function _removeOwnedValueItemId(
        address owner,
        uint value,
        uint itemId
    ) internal {
        uint[] storage ids = _ownedValueItemIds[owner][value];
        if (ids.length == 0) return;
        uint removingIndex = _ownedValueItemIndexes[owner][itemId];
        uint lastIndex = ids.length - 1;
        if (removingIndex != lastIndex) {
            uint lastId = ids[lastIndex];
            ids[removingIndex] = lastId;
            _ownedValueItemIndexes[owner][lastId] = removingIndex;
        }
        ids.pop();
        delete _ownedValueItemIndexes[owner][itemId];
    }

    function _getLastOwnerItemIdByValue(
        address owner,
        uint value
    ) internal view returns (uint) {
        uint[] storage ids = _ownedValueItemIds[owner][value];
        if (ids.length == 0) return 0;
        return ids[ids.length - 1];
    }

    function transferItem(address to, uint itemId) external returns (bool) {
        return _transferItem(msg.sender, to, itemId);
    }

    function transfer_item(address to, uint itemId) external returns (bool) {
        return _transferItem(msg.sender, to, itemId);
    }

    function _transferItem(
        address from,
        address to,
        uint itemId
    ) internal returns (bool) {
        if (from == address(0)) revert TransferFromZero();
        if (to == address(0)) revert TransferToZero();
        SeedData memory data = _ownedTokens[from][itemId];
        if (data.value == 0) return false;

        uint amount = data.value * _tokenUnit();
        if (_balances[from] < amount) revert TransferAmountExceedsBalance();
        _removeItemFromOwner(from, itemId);

        unchecked {
            _balances[from] -= amount;
            _balances[to] += amount;
        }
        emit Transfer(from, to, amount);

        if (_isItemSource(to)) {
            emit OnItemBurn(from, itemId, data.value, _BURN_REASON_TO_SOURCE);
        } else {
            _addItemToOwnerWithId(to, data, itemId);
            emit OnItemTransfer(from, to, itemId, data);
        }

        _enforceInvariant(from);
        _enforceInvariant(to);
        return true;
    }

    function isOwnerOf(address owner, uint item_id) external view returns (bool) {
        return _owns[owner][item_id];
    }

    function roeDegree(
        address owner
    ) external view returns (SeedData memory roe_data) {
        return _roe[owner];
    }

    function sporesDegree(
        address owner
    ) external view returns (SeedData memory roe_data) {
        return _roe[owner];
    }

    function itemCount(address owner) external view returns (uint) {
        return _itemCounts[owner];
    }

    function mushroomCount(address owner) external view returns (uint) {
        return _itemCounts[owner];
    }

    function itemsTotalCount() external view returns (uint) {
        return _itemsTotalCount;
    }

    function mushroomsTotalCount() external view returns (uint) {
        return _itemsTotalCount;
    }

    function holdersCount() external view returns (uint) {
        return _holdersCount;
    }

    function roeTotalCount() external view returns (uint) {
        return _roeTotalCount;
    }

    function sporesTotalCount() external view returns (uint) {
        return _roeTotalCount;
    }

    function getHolderIndex(address account) external view returns (uint) {
        return _holderListIndexes[account];
    }

    function getHoldersPage(
        uint startIndex,
        uint count
    ) external view returns (address[] memory holders, uint total) {
        total = _holdersCount;
        if (startIndex >= total || count == 0) {
            return (new address[](0), total);
        }
        uint n = count;
        if (n > total - startIndex) {
            n = total - startIndex;
        }
        holders = new address[](n);
        for (uint i = 0; i < n; ++i) {
            holders[i] = _holderList[startIndex + i];
        }
    }

    function getOwnerItemsPage(
        address owner,
        uint startIndex,
        uint count
    )
        external
        view
        returns (uint[] memory itemIds, SeedData[] memory items, uint total)
    {
        total = _itemCounts[owner];
        if (startIndex >= total || count == 0) {
            return (new uint[](0), new SeedData[](0), total);
        }
        uint n = count;
        if (n > total - startIndex) {
            n = total - startIndex;
        }
        itemIds = new uint[](n);
        items = new SeedData[](n);
        for (uint i = 0; i < n; ++i) {
            uint idx = startIndex + i;
            uint itemId = _ownedTokenIds[owner][idx];
            itemIds[i] = itemId;
            items[i] = _ownedTokens[owner][itemId];
        }
    }

    function _isKnownValue(uint value) internal pure returns (bool) {
        return value == _VALUE_LVL_1 || value == _VALUE_LVL_2 ||
            value == _VALUE_LVL_3 || value == _VALUE_LVL_4 || value == _VALUE_LVL_5;
    }

    function itemIdsByValue(
        address owner,
        uint value,
        uint offset,
        uint limit
    ) external view returns (uint[] memory itemIds, uint total) {
        if (!_isKnownValue(value)) {
            return (new uint[](0), 0);
        }
        uint[] storage ids = _ownedValueItemIds[owner][value];
        total = ids.length;
        if (offset >= total || limit == 0) {
            return (new uint[](0), total);
        }
        uint n = limit;
        if (n > total - offset) {
            n = total - offset;
        }
        itemIds = new uint[](n);
        for (uint i = 0; i < n; ++i) {
            itemIds[i] = ids[offset + i];
        }
    }

    function reorderItemsByValue(
        uint value,
        uint itemIdA,
        uint itemIdB
    ) external {
        address owner = msg.sender;
        if (!_isKnownValue(value)) revert UnknownValue();
        if (!_owns[owner][itemIdA] || !_owns[owner][itemIdB]) revert NotOwnerOfItems();
        if (_ownedTokens[owner][itemIdA].value != value) revert ItemValueMismatch();
        if (_ownedTokens[owner][itemIdB].value != value) revert ItemValueMismatch();
        if (itemIdA == itemIdB) return;

        uint[] storage ids = _ownedValueItemIds[owner][value];
        uint idxA = _ownedValueItemIndexes[owner][itemIdA];
        uint idxB = _ownedValueItemIndexes[owner][itemIdB];
        (ids[idxA], ids[idxB]) = (ids[idxB], ids[idxA]);
        _ownedValueItemIndexes[owner][itemIdA] = idxB;
        _ownedValueItemIndexes[owner][itemIdB] = idxA;
    }
}

contract Pepi is HasItemsWithRoe, Generator {
    uint constant _startTotalSupply = 13370 * (10 ** _decimals);
    uint constant _startMaxBuyCount = (_startTotalSupply * 5) / 10000;
    uint constant _addMaxBuyPercentPerSec = 5; // 100%=_addMaxBuyPrecesion add 0.005%/second
    uint constant _addMaxBuyPrecesion = 100000;

    constructor() {
        _mint(msg.sender, _startTotalSupply);
    }

    modifier maxBuyLimit(uint256 amount) {
        if (amount > maxBuy()) revert MaxBuyLimit();
        _;
    }

    function setItemSource(address addr, bool value) external onlyOwner {
        _setItemSource(addr, value);
    }

    function _isItemSource(address addr) internal override view returns (bool) {
        return addr == _pool || super._isItemSource(addr);
    }

    function maxBuy() public view returns (uint256) {
        if (!isStarted()) return _startTotalSupply;
        uint256 count = _startMaxBuyCount +
            (_startTotalSupply *
                (block.timestamp - _startTime) *
                _addMaxBuyPercentPerSec) /
            _addMaxBuyPrecesion;
        if (count > _startTotalSupply) count = _startTotalSupply;
        return count;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        bool started = isStarted();
        bool mintFromSource;
        uint roeFrom = 0;

        if (started && from != address(this)) {
            mintFromSource = isItemSource(from);
            if (!mintFromSource && to != address(0)) {
                roeFrom = _targetRoe(from);
            }
        }

        if (isStarted()) {
            // logic is handled after token balance changes
        } else {
            if (from != _owner && to != _owner) revert NotStarted();
        }

        // allow burning
        if (to == address(0)) {
            _burn(from, amount);
            if (started) _handleTransferState(from, to, amount, roeFrom, false);
            return;
        }

        // system transfers
        if (from == address(this)) {
            super._transfer(from, to, amount);
            if (started) _enforceInvariant(to);
            return;
        }

        if (_feeLocked) {
            super._transfer(from, to, amount);
        } else {
            if (isItemSource(from)) {
                _transferFromPool(from, to, amount);
            } else {
                super._transfer(from, to, amount);
            }
        }

        if (started) {
            _handleTransferState(from, to, amount, roeFrom, mintFromSource);
        }
    }

    function _transferFromPool(
        address from,
        address to,
        uint256 amount
    ) private maxBuyLimit(amount) lockFee {
        super._transfer(from, to, amount);
    }

    function burnCount() public view returns (uint256) {
        return _startTotalSupply - totalSupply();
    }

    /// @dev Override: normalize roe value (raw) to whole units for lvl when value > 8 (roe uses raw units).
    function getItemData(
        SeedData calldata seed_data
    ) external view override returns (ItemData memory) {
        uint effectiveValue = seed_data.value <= 8
            ? seed_data.value
            : seed_data.value / _tokenUnit();
        SeedData memory normalized = SeedData({
            lvl: seed_data.lvl,
            value: effectiveValue,
            seed1: seed_data.seed1,
            seed2: seed_data.seed2
        });
        return _buildItemDataFromSeed(normalized);
    }
}
