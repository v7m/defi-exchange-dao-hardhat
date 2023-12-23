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

contract LiquidityPoolNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private s_tokenCounter;
    using Strings for uint256;

    bool private s_initialized;
    address public s_liquidityPoolContractAddress;

    event NftMinted(uint256 tokenId, address indexed minter, uint256 ethAmount, uint256 daiAmount, uint256 usdtAmount);
    event NftBurned(uint256 tokenId, address indexed burner);
    event LiquidityPoolContractSet(address liquidityPoolContractAddress);

    modifier onlyLiquidityPoolContract() {
        if (msg.sender != s_liquidityPoolContractAddress) {
            revert LiquidityPoolNFT__AllowedOnlyForLiquidityPoolContract();
        }
        _;
    }

    constructor() ERC721("LiquidityPoolNFT", "LPNFT") {}

    function initialize(address _liquidityPoolContractAddress) external onlyOwner {
        if (s_initialized) {
            revert LiquidityPoolNFT__LiquidityPoolContractAlreadySet();
        }

        s_liquidityPoolContractAddress = _liquidityPoolContractAddress;
        s_initialized = true;
        emit LiquidityPoolContractSet(_liquidityPoolContractAddress);
    }

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

    function burnNFT(address user, uint256 tokenId) external onlyLiquidityPoolContract {
        if (!_isApprovedOrOwner(user, tokenId)) {
            revert LiquidityPoolNFT__BurnCallerIsNotOwnerApprovedOrOperator(user, tokenId);
        }
        _burn(tokenId);
        emit NftBurned(tokenId, user);
    }

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

    function getLiquidityPoolContractAddress() external view returns (address) {
        return s_liquidityPoolContractAddress;
    }

    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter.current();
    }
}
