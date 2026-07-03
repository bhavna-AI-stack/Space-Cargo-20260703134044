require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "paris"
    }
  },
  networks: {
    scaiTestnet: {
      url: "https://testnet-rpc.securechain.ai",
      chainId: 3434,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
    scaiMainnet: {
      url: "https://mainnet-rpc.scai.network",
      chainId: 34,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
  etherscan: {
    customChains: [
      {
        network: "scaiTestnet",
        chainId: 3434,
        urls: {
          apiURL: "https://testnet-explorer.securechain.ai/api",
          browserURL: "https://testnet-explorer.securechain.ai",
        },
      },
      {
        network: "scaiMainnet",
        chainId: 34,
        urls: {
          apiURL: "https://explorer.scai.network/api",
          browserURL: "https://explorer.scai.network",
        },
      },
    ],
  },
};
