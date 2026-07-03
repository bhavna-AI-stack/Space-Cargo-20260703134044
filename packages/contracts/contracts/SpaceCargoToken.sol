// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SpaceCargoToken is ERC20, EIP712, AccessControl, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    bytes32 public constant GAME_SERVER_ROLE = keccak256("GAME_SERVER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // EIP-712 type hash for reward claims
    bytes32 public constant REWARD_TYPEHASH = keccak256("Reward(address player,uint256 amount,uint256 nonce)");

    // Nonce per player address for replay protection
    mapping(address => uint256) public nonces;

    // Minimum claim amount (in tokens, with 18 decimals)
    uint256 public minClaimAmount = 100 * 10**18; // 100 tokens minimum

    event RewardClaimed(address indexed player, uint256 amount, uint256 nonce);
    event MinClaimAmountUpdated(uint256 oldAmount, uint256 newAmount);

    constructor(
        address _gameServer,
        address _admin
    ) ERC20("Space Cargo Runner", "SCR") EIP712("SpaceCargoToken", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(GAME_SERVER_ROLE, _gameServer);
    }

    /**
     * @notice Claim reward tokens by providing a valid server signature
     * @param amount The amount of tokens to claim (with 18 decimals)
     * @param nonce The nonce for replay protection (must match current nonce for msg.sender)
     * @param signature The EIP-712 signature from the game server
     */
    function claimReward(
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(amount >= minClaimAmount, "Amount below minimum");
        require(nonce == nonces[msg.sender], "Invalid nonce");

        // Build the EIP-712 struct hash
        bytes32 structHash = keccak256(
            abi.encode(REWARD_TYPEHASH, msg.sender, amount, nonce)
        );
        bytes32 hash = _hashTypedDataV4(structHash);

        // Recover signer and verify it has the GAME_SERVER_ROLE
        address signer = hash.recover(signature);
        require(hasRole(GAME_SERVER_ROLE, signer), "Invalid signature");

        // Increment nonce to prevent replay
        nonces[msg.sender]++;

        // Mint tokens to the player
        _mint(msg.sender, amount);

        emit RewardClaimed(msg.sender, amount, nonce);
    }

    /**
     * @notice Update the minimum claim amount (admin only)
     */
    function setMinClaimAmount(uint256 _newAmount) external onlyRole(ADMIN_ROLE) {
        uint256 oldAmount = minClaimAmount;
        minClaimAmount = _newAmount;
        emit MinClaimAmountUpdated(oldAmount, _newAmount);
    }

    /**
     * @notice Pause the contract (admin only)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the contract (admin only)
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
