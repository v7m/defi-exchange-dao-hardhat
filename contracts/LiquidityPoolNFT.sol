// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./DeFiExchange.sol";

error ERC721Metadata__TokenNotExist();
error LiquidityPoolNFT__InvalidAmountForForMintingNFT(address sender, uint256 ethAmount, uint256 usdtAmount, uint256 daiAmount);
error LiquidityPoolNFT__BurnCallerIsNotOwnerApprovedOrOperator(address sender, uint256 tokenId);
error LiquidityPoolNFT__LiquidityPoolContractAlreadySet();
error LiquidityPoolNFT__AllowedOnlyForLiquidityPoolContract();

/**
 * @title LiquidityPoolNFT
 * @dev This contract represents a liquidity pool non-fungible token (NFT).
 */
contract LiquidityPoolNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private s_tokenCounter;
    using Strings for uint256;

    bool private s_initialized;
    address public s_liquidityPoolContractAddress;

    event NftMinted(uint256 tokenId, address indexed minter, uint256 ethAmount, uint256 daiAmount, uint256 usdtAmount);
    event NftBurned(uint256 tokenId, address indexed burner);
    event LiquidityPoolContractSet(address liquidityPoolContractAddress);

    /**
     * @dev Modifier to restrict access to only the Liquidity Pool contract.
     * @notice This modifier ensures that the function can only be called by the Liquidity Pool contract.
     */
    modifier onlyLiquidityPoolContract() {
        if (msg.sender != s_liquidityPoolContractAddress) {
            revert LiquidityPoolNFT__AllowedOnlyForLiquidityPoolContract();
        }
        _;
    }

    constructor() ERC721("LiquidityPoolNFT", "LPNFT") {}

    /**
     * @dev Initializes the LiquidityPoolNFT contract by setting the liquidity pool contract address.
     * @param _liquidityPoolContractAddress The address of the liquidity pool contract.
     */
    function initialize(address _liquidityPoolContractAddress) external onlyOwner {
        if (s_initialized) {
            revert LiquidityPoolNFT__LiquidityPoolContractAlreadySet();
        }

        s_liquidityPoolContractAddress = _liquidityPoolContractAddress;
        s_initialized = true;
        emit LiquidityPoolContractSet(_liquidityPoolContractAddress);
    }

    /**
     * @dev Mint a new NFT for a user with specified amounts of ETH, DAI, and USDT.
     * @param user The address of the user receiving the NFT.
     * @param ethAmount The amount of ETH associated with the NFT.
     * @param daiAmount The amount of DAI associated with the NFT.
     * @param usdtAmount The amount of USDT associated with the NFT.
     * @return The ID of the newly minted NFT.
     */
    function mintNFT(
        address user, 
        uint256 ethAmount, 
        uint256 daiAmount, 
        uint256 usdtAmount
    ) external onlyLiquidityPoolContract returns (uint256) {
        if (ethAmount == 0 && usdtAmount == 0 && daiAmount == 0) {
            revert LiquidityPoolNFT__InvalidAmountForForMintingNFT(user, ethAmount, usdtAmount, daiAmount);
        }
        uint256 newItemId = s_tokenCounter.current();
        _safeMint(user, newItemId);
        _setTokenURI(newItemId, generateTokenURI(newItemId, ethAmount, daiAmount, usdtAmount));
        s_tokenCounter.increment();
        emit NftMinted(s_tokenCounter.current(), user, ethAmount, daiAmount, usdtAmount);
        return newItemId;
    }

    /**
     * @dev Burns an NFT token owned by a specific user.
     * @param user The address of the user who owns the NFT token.
     * @param tokenId The ID of the NFT token to be burned.
     * @notice This function can only be called by the LiquidityPool contract.
     * @notice The caller must be the owner or have approval to burn the NFT token.
     * @notice Emits a `NftBurned` event after the NFT token is burned.
     */
    function burnNFT(address user, uint256 tokenId) external onlyLiquidityPoolContract {
        if (!_isApprovedOrOwner(user, tokenId)) {
            revert LiquidityPoolNFT__BurnCallerIsNotOwnerApprovedOrOperator(user, tokenId);
        }
        _burn(tokenId);
        emit NftBurned(tokenId, user);
    }

    /**
     * @dev Generates the token URI for a Liquidity Pool NFT.
     * @param tokenId The ID of the token.
     * @param ethAmount The amount of ETH in the liquidity pool.
     * @param daiAmount The amount of DAI in the liquidity pool.
     * @param usdtAmount The amount of USDT in the liquidity pool.
     * @return The generated token URI.
     */
    function generateTokenURI(
        uint256 tokenId, 
        uint256 ethAmount,
        uint256 daiAmount, 
        uint256 usdtAmount
    ) internal view returns (string memory) {
        if (!_exists(tokenId)) {
            revert ERC721Metadata__TokenNotExist();
        }

        bytes memory dataURI = abi.encodePacked(
            "{",
                "\"name\": \"Liquidity Pool NFT #", tokenId.toString(), "\", ",
                "\"description\": \"Liquidity Pool NFT\", ",
                "\"attributes\": ["
                    "{"
                        "\"liquidity\": ["
                            "{"
                                "\"liquidity_type\": \"ETH\","
                                "\"value\": \"", ethAmount.toString(), "\""
                            "}",
                            "{"
                                "\"liquidity_type\": \"DAI\","
                                "\"value\": \"", daiAmount.toString(), "\""
                            "}",
                            "{"
                                "\"liquidity_type\": \"USDT\","
                                "\"value\": \"", usdtAmount.toString(), "\""
                            "}"
                        "",
                    "}"
                "]"
            "{"
        );

        return string(dataURI);
    }

    /**
     * @dev Retrieves the address of the liquidity pool contract.
     * @return The address of the liquidity pool contract.
     */
    function getLiquidityPoolContractAddress() external view returns (address) {
        return s_liquidityPoolContractAddress;
    }

    /**
     * @dev Returns the current token counter.
     * @return The current token counter as a uint256 value.
     */
    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter.current();
    }
}
