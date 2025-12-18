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

const upgradePolemarchWithdrawals: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network, ethers } = hre;
  const Polemarch = await ethers.getContractFactory("Polemarch");
  const polemarchAddress = polemarchUpgradeConfig[network.name]["Polemarch"].address;
  const polemarch = await upgrades.upgradeProxy(
    polemarchAddress,
    Polemarch
  );
  await polemarch.deployTransaction.wait(1);
  console.log("Upgraded the implementation of Polemarch with withdrawals function");
}

export default upgradePolemarchWithdrawals;
upgradePolemarchWithdrawals.tags = ["04-polemarch-upgrade"];