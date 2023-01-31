import "@typechain/hardhat";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "solidity-coverage";
import "hardhat-deploy";
import "hardhat-gas-reporter"
import "dotenv/config";

const GOERLI_RPC_URL =
  process.env.GOERLI_RPC_URL || "https://eth-rinkbey/example";
  const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xkey";
const MAINNET_PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "key";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "key";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: "0.8.8",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    goerli: {
      url: GOERLI_RPC_URL,
      accounts: [PRIVATE_KEY!],
      chainId: 5,
      saveDeployments: true,
    },
    mainnet: {
      url: MAINNET_RPC_URL,
      accounts: MAINNET_PRIVATE_KEY !== undefined ? [MAINNET_PRIVATE_KEY] : [],
      chainId: 1,
      saveDeployments: true,
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: false,
    outputFile: "gas-report.txt",
    noColors: true,
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY,
  },
  namedAccounts: {
    deployer: 0,
  },
};

export default config;
