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
  let polemarch: Polemarch;
  let sToken: SToken;
  let gToken: GToken;
  let sWETH: SToken;
  let gWETH: GToken;
  let thurmanGov2: ThurmanGovernor2;
  let thurmanGov: ThurmanGovernor;
  let thurman: ThurmanToken;

  const { deployments, network } = hre;
  const { deploy, log } = deployments;
  const [deployer, ...users]: SignerWithAddress[] = await ethers.getSigners();
  console.log("deployer address: ", deployer.address);
  const chainId: number = network.config.chainId!;
  console.log("chainId: ", chainId);

  if (developmentChains.includes(network.name)) {
    let weth: WETH9;
    let wethAddress: string;
    let dWETH: DToken;
    let dUSDC: DToken;
    let timelock: ThurmanTimelock;

    const Polemarch = await ethers.getContractFactory("Polemarch");
    polemarch = await upgrades.deployProxy(Polemarch, []);
    await polemarch.deployTransaction.wait(1);
    log(`[polemarch address]: ${polemarch.address}`);
    const SToken = await ethers.getContractFactory("SToken");
    const DToken = await ethers.getContractFactory("DToken");
    const GToken = await ethers.getContractFactory("GToken");
    const Thurman = await ethers.getContractFactory("ThurmanToken");

    const Weth = await ethers.getContractFactory("WETH9");
    weth = await Weth.deploy();
    wethAddress = weth.address;

    log("Creating a new instance of sWETH and dWETH tokens with deployer");

    sWETH = await upgrades.deployProxy(SToken, [
      polemarch.address,
      "sWETH",
      "S_WETH",
      WETH_DECIMALS,
      deployer.address,
      weth.address,
    ], {
      unsafeAllow: ['constructor']
    });
    await sWETH.deployTransaction.wait(1);
    dWETH = await upgrades.deployProxy(DToken, [
      polemarch.address,
      "dWETH",
      "D_WETH",
      WETH_DECIMALS,
      deployer.address,
      weth.address,
    ], {
      unsafeAllow: ['constructor']
    });
    await dWETH.deployTransaction.wait(1);

    gWETH = await upgrades.deployProxy(GToken, [
      polemarch.address,
      "gWETH",
      "G_WETH",
      WETH_DECIMALS,
      deployer.address,
      weth.address,
    ], {
      unsafeAllow: ['constructor', 'state-variable-immutable']
    });
    await gWETH.deployed();

    const tx = await polemarch.addExchequer(
      weth.address, 
      sWETH.address, 
      dWETH.address, 
      gWETH.address, 
      WETH_DECIMALS, 
      parseEther("0.05")
    );
    await tx.wait();
    let exchequer: Types.ExchequerStruct = await polemarch.getExchequer(wethAddress);
    log(`weth exchequer: ${exchequer}`);

    thurman = await upgrades.deployProxy(Thurman, [
      polemarch.address,
      "thurman",
      "THURM",
      WETH_DECIMALS,
    ], {
      unsafeAllow: ['missing-initializer-call'],
      unsafeSkipStorageCheck: true
    });
    await thurman.deployTransaction.wait(1);

    const Timelock = await ethers.getContractFactory("ThurmanTimelock");
    timelock = await upgrades.deployProxy(Timelock, [
      TIMELOCK_MIN_DELAY,
      [deployer.address],
      [deployer.address],
      deployer.address,
    ], {
      unsafeAllow: ['constructor']
    });
    await timelock.deployTransaction.wait(1);

    const ThurmanGov = await ethers.getContractFactory("ThurmanGovernor");
    thurmanGov = await upgrades.deployProxy(ThurmanGov, [
      thurman.address,
      timelock.address,
      "ThurmanDAO",
      upgradeConfig[network.name].govVotingDelay,
      upgradeConfig[network.name].govVotingPeriod,
      upgradeConfig[network.name].govProposalThreshold
    ], {
      unsafeAllow: ['constructor', 'missing-initializer']
    });
    await thurmanGov.deployTransaction.wait(1);

    await timelock.grantRole(ethers.utils.id("TIMELOCK_ADMIN_ROLE"), thurmanGov.address);
    await timelock.grantRole(ethers.utils.id("PROPOSER_ROLE"), thurmanGov.address);
    await timelock.grantRole(ethers.utils.id("EXECUTOR_ROLE"), thurmanGov.address);
  }

  let polemarchAddress: string;
  
  if (developmentChains.includes(network.name)) {
    polemarchAddress = polemarch.address;
  } else {
    const configAddress = polemarchUpgradeConfig[network.name]?.["Polemarch"]?.address;
    if (!configAddress || configAddress.trim() === "") {
      throw new Error(`Polemarch address not configured for network: ${network.name}`);
    }
    polemarchAddress = configAddress.trim();
  }

  // Validate address format
  try {
    polemarchAddress = ethers.utils.getAddress(polemarchAddress);
  } catch (error) {
    throw new Error(`Invalid Polemarch address for network ${network.name}: ${polemarchAddress}`);
  }

  log(`Upgrading Polemarch at address: ${polemarchAddress}`);
  
  // Verify the address has code (is a contract)
  const code = await ethers.provider.getCode(polemarchAddress);
  if (code === "0x") {
    throw new Error(`No contract code found at address: ${polemarchAddress}`);
  }
  
  // Verify the proxy address is valid and get current implementation
  try {
    const currentImpl = await upgrades.erc1967.getImplementationAddress(polemarchAddress);
    log(`Current Polemarch implementation: ${currentImpl}`);
  } catch (error: any) {
    throw new Error(`Invalid proxy address or not a proxy: ${polemarchAddress}. Error: ${error.message}`);
  }

  const Polemarch = await ethers.getContractFactory("Polemarch");
  
  try {
    log("Performing Polemarch upgrade...");
    polemarch = await upgrades.upgradeProxy(
      polemarchAddress, 
      Polemarch
    );

    if (!polemarch.deployTransaction) {
      throw new Error("Polemarch upgrade transaction not found");
    }

    if (!polemarch.deployTransaction.hash) {
      throw new Error("Polemarch upgrade transaction hash not found");
    }

    log(`Waiting for Polemarch upgrade transaction: ${polemarch.deployTransaction.hash}`);
    await polemarch.deployTransaction.wait(1);
    log("Upgraded the implementation of Polemarch with ownerRepay function");
  } catch (error: any) {
    log(`Error upgrading Polemarch: ${error.message}`);
    throw error;
  }

  // Upgrade ThurmanToken
  let thurmanTokenAddress: string | undefined;
  if (developmentChains.includes(network.name)) {
    thurmanTokenAddress = thurman.address;
  } else {
    const configAddress = thurmanTokenAddressConfig[network.name]?.address;
    thurmanTokenAddress = configAddress && configAddress.trim() !== "" ? configAddress.trim() : undefined;
  }

  if (thurmanTokenAddress) {
    try {
      // Validate address format
      thurmanTokenAddress = ethers.utils.getAddress(thurmanTokenAddress);
      
      log(`Upgrading ThurmanToken at address: ${thurmanTokenAddress}`);
      const ThurmanToken = await ethers.getContractFactory("ThurmanToken");
      const upgradedThurman = await upgrades.upgradeProxy(
        thurmanTokenAddress,
        ThurmanToken,
        {
          unsafeAllow: ['missing-initializer-call'],
          unsafeSkipStorageCheck: true
        }
      );

      if (!upgradedThurman.deployTransaction || !upgradedThurman.deployTransaction.hash) {
        throw new Error("ThurmanToken upgrade transaction not found or invalid");
      }

      log(`Waiting for ThurmanToken upgrade transaction: ${upgradedThurman.deployTransaction.hash}`);
      await upgradedThurman.deployTransaction.wait(1);
      log("Upgraded the implementation of ThurmanToken");

      if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
      ) {
        await verify(upgradedThurman.address, []);
      }
    } catch (error: any) {
      log(`Error upgrading ThurmanToken: ${error.message}`);
      throw error;
    }
  } else {
    log(`Skipping ThurmanToken upgrade - address not configured for ${network.name}`);
  }

  // Upgrade ThurmanGovernor2
  let thurmanGovAddress: string | undefined;
  if (developmentChains.includes(network.name)) {
    // In development, upgrade the ThurmanGovernor we just deployed to ThurmanGovernor2
    thurmanGovAddress = thurmanGov.address;
  } else {
    const configAddress = governorAddressConfig[network.name]?.address;
    thurmanGovAddress = configAddress && configAddress.trim() !== "" ? configAddress.trim() : undefined;
  }

  if (thurmanGovAddress) {
    try {
      // Validate address format
      thurmanGovAddress = ethers.utils.getAddress(thurmanGovAddress);
      
      const currentImplementation = await upgrades.erc1967.getImplementationAddress(thurmanGovAddress);
      log(`The current implementation address of ThurmanGovernor is ${currentImplementation}`);

      log(`Upgrading ThurmanGovernor2 at address: ${thurmanGovAddress}`);
      const ThurmanGov2 = await ethers.getContractFactory("ThurmanGovernor2");
      thurmanGov2 = await upgrades.upgradeProxy(
        thurmanGovAddress,
        ThurmanGov2,
        {
          unsafeAllow: ['constructor', 'missing-initializer']
        }
      );

      if (!thurmanGov2.deployTransaction || !thurmanGov2.deployTransaction.hash) {
        throw new Error("ThurmanGovernor2 upgrade transaction not found or invalid");
      }

      log(`Waiting for ThurmanGovernor2 upgrade transaction: ${thurmanGov2.deployTransaction.hash}`);
      await thurmanGov2.deployTransaction.wait(1);
      log("Upgraded the implementation of ThurmanGovernor to ThurmanGovernor2");
      const newImplementation = await upgrades.erc1967.getImplementationAddress(thurmanGovAddress);
      log(`The new implementation address is ${newImplementation}`);

      if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
      ) {
        await verify(thurmanGov2.address, []);
      }
    } catch (error: any) {
      log(`Error upgrading ThurmanGovernor2: ${error.message}`);
      throw error;
    }
  } else {
    log(`Skipping ThurmanGovernor2 upgrade - address not configured for ${network.name}`);
  }

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(polemarch.address, []);
  } 
}

export default upgradePolemarchOwnerRepay;
upgradePolemarchOwnerRepay.tags = ["05-polemarch-upgrade"];