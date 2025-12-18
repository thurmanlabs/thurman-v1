import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { verify } from "../utils/verify";
import { upgrades } from "hardhat";

interface IPolemarchUpgradeConfig {
  [key: string]: {
    [contract: string]: {
      address: string;
    }
  };
};

interface IGovernorTokenConfig {
  [key: string]: {
    address: string;
  };
}

const polemarchUpgradeConfig: IPolemarchUpgradeConfig = {
  "mainnet": {
    "Polemarch": {
      address: "0x092Cb11b1d114Ed97f57f7A003dc68a13e58FE9f"
    },
    "sUSDC": {
      address: "0x661e2eA95Aa93cd8398C19E8519b2811888Df75d"
    },
    "gUSDC": {
      address: "0xc6aA41FC6e27fF39CC3F12dE4844a585d8b10cF0"
    }
  },
  "goerli": {
    "Polemarch": {
      address: "0x1De9cAFFc75013501c794cfd8fb82aD6FfE2517f"
    },
    "sUSDC": {
      address: "0x2F20A09579c734Cb03624AB8eA1E909163f361F7"
    },
    "gUSDC": {
      address: "0x23C6f81b54143660e73f3eE5A39d7E7A06E45d15"
    }
  },
  "sepolia": {
    "Polemarch": {
      address: "0xfb60D5eaE1741D6894e45c5ead36b889121827A5"
    },
    "sUSDC": {
      address: "0xe15aF8636E03d7460dAd17A02eab9425BBF9F65A"
    },
    "gUSDC": {
      address: "0x8A279D3bcfD6200373248772155FdF0455F6BeB2"
    }
  }
};

const governorAddressConfig: IGovernorTokenConfig = {
  "mainnet": {
    address: "0x6518998C230Ceb7A7AD530c7088f0747604C06f5"
  },
  "goerli": {
    address: "0x5D368EBa7e692CbcbD44a85a33Eaf303968c6548"
  },
  "sepolia": {
    address: "0x31565a179c836108D61E663D4C7Ed401c92B3a3D" // TODO: Add sepolia governor address
  }
};

const thurmanTokenAddressConfig: IGovernorTokenConfig = {
  "mainnet": {
    address: "0xA92FC16902a12876e0C6C2eC23502d1BfC35E96F" // TODO: Add mainnet ThurmanToken address
  },
  "goerli": {
    address: "0x1ecc1Cf55E17e5442b59F6493736043C0bFBBD3d" // TODO: Add goerli ThurmanToken address
  },
  "sepolia": {
    address: "0x1E85dC105Aabc4cFd2E248d3a9347a006E4A189d" // TODO: Add sepolia ThurmanToken address
  }
};

interface IUpgradeConfig {
  [key: string]: {
    govVotingDelay: number;
    govVotingPeriod: number;
    govProposalThreshold: number;
  };
}

const upgradeConfig: IUpgradeConfig = {
  "mainnet": {
    govVotingDelay: 0,
    govVotingPeriod: 225,
    govProposalThreshold: 0,
  },
  "goerli": {
    govVotingDelay: 0,
    govVotingPeriod: 40,
    govProposalThreshold: 0,
  },
  "sepolia": {
    govVotingDelay: 0,
    govVotingPeriod: 40,
    govProposalThreshold: 0,
  },
  "hardhat": {
    govVotingDelay: 0,
    govVotingPeriod: 40,
    govProposalThreshold: 0,
  },
  "localhost": {
    govVotingDelay: 0,
    govVotingPeriod: 40,
    govProposalThreshold: 0,
  }
};

const WETH_DECIMALS = 18;
const TIMELOCK_MIN_DELAY = 0;

const developmentChains = ["hardhat", "localhost"];

const upgradePolemarchOwnerRepay: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network, ethers } = hre;
  const Polemarch = await ethers.getContractFactory("Polemarch");
  await Polemarch.deploy();
  const polemarchAddress = polemarchUpgradeConfig[network.name]["Polemarch"].address;
  const polemarch = await upgrades.upgradeProxy(
    polemarchAddress,
    Polemarch, {
      useDeployedImplementation: false,
    }
  );  

  console.log("Upgraded the implementation of Polemarch with owner repay function");

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(polemarch.address, []);
  } 
}

export default upgradePolemarchOwnerRepay;
upgradePolemarchOwnerRepay.tags = ["05-polemarch-upgrade"];