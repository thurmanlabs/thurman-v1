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

const upgradePolemarch: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  let polemarch: Polemarch;
  let sToken: SToken;
  let gToken: GToken;
  let sWETH: SToken;
  let gWETH: GToken;

  const { deployments, network } = hre;
  const { deploy, log } = deployments;
  const [deployer, ...users]: SignerWithAddress[] = await ethers.getSigners();
  console.log("deployer address: ", deployer.address);
  const chainId: number = network.config.chainId!;
  console.log("chainId: ", chainId);

  if (developmentChains.includes(network.name)) {
    // let polemarch: Polemarch;
    let weth: WETH9;
    let wethAddress: string;
    // let sWETH: SToken;
    let dWETH: DToken;
    // let gWETH: GToken;
    // let sUSDC: SToken;
    let dUSDC: DToken;
    // let gUSDC: GToken;
    let thurmanGov: ThurmanGovernor;
    let thurman: ThurmanToken;
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
    ]);
    await sWETH.deployTransaction.wait(1);
    dWETH = await upgrades.deployProxy(DToken, [
      polemarch.address,
      "dWETH",
      "D_WETH",
      WETH_DECIMALS,
      deployer.address,
      weth.address,
    ]);
    await dWETH.deployTransaction.wait(1);

    gWETH = await upgrades.deployProxy(GToken, [
      polemarch.address,
      "gWETH",
      "G_WETH",
      WETH_DECIMALS,
      deployer.address,
      weth.address,
    ]);
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
    ]);
    await thurman.deployTransaction.wait(1);

    const Timelock = await ethers.getContractFactory("ThurmanTimelock");
    timelock = await upgrades.deployProxy(Timelock, [
      TIMELOCK_MIN_DELAY,
      [deployer.address],
      [deployer.address],
      deployer.address,
    ]);
    await timelock.deployTransaction.wait(1);

    const ThurmanGov = await ethers.getContractFactory("ThurmanGovernor");
    thurmanGov = await upgrades.deployProxy(ThurmanGov, [
      thurman.address,
      timelock.address,
      "ThurmanDAO",
      upgradeConfig[network.name].govVotingDelay,
      upgradeConfig[network.name].govVotingPeriod,
      upgradeConfig[network.name].govProposalThreshold
    ]);
    await thurmanGov.deployTransaction.wait(1);

    await timelock.grantRole(ethers.utils.id("TIMELOCK_ADMIN_ROLE"), thurmanGov.address);
    await timelock.grantRole(ethers.utils.id("PROPOSER_ROLE"), thurmanGov.address);
    await timelock.grantRole(ethers.utils.id("EXECUTOR_ROLE"), thurmanGov.address);
  }

  let polemarchAddress: string;
  let sTokenAddress: string;
  let gTokenAddress: string;
  
  if (developmentChains.includes(network.name)) {
    polemarchAddress = polemarch.address;
    sTokenAddress = sWETH.address;
    gTokenAddress = gWETH.address;
  } else {
    polemarchAddress = polemarchUpgradeConfig[network.name]["Polemarch"].address;
    sTokenAddress = polemarchUpgradeConfig[network.name]["sUSDC"].address;
    gTokenAddress = polemarchUpgradeConfig[network.name]["gUSDC"].address;
  }

  const Polemarch = await ethers.getContractFactory("Polemarch");
  polemarch = await upgrades.upgradeProxy(
    polemarchAddress, 
    Polemarch
  );

  await polemarch.deployTransaction.wait(1);
  log("Upgraded the implementation of Polemarch");
  // const newImplementation = await upgrades.erc1967.getImplementationAddress(thurmanGovAddress);
  // log(`The new implementation address is ${newImplementation}`);

  const SToken = await ethers.getContractFactory("SToken");
  sToken = await upgrades.upgradeProxy(
    sTokenAddress, 
    SToken
  );

  await sToken.deployTransaction.wait(1);

  log("Upgraded the implementation of sUSDC");

  const GToken = await ethers.getContractFactory("GToken");
  gToken = await upgrades.upgradeProxy(
    gTokenAddress, 
    GToken
  );

  await gToken.deployTransaction.wait(1);
  log("Upgraded the implementation of gUSDC");

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(polemarch.address, []);
    await verify(sToken.address, []);
    await verify(gToken.address, []);
  } 
}

export default upgradePolemarch;
upgradePolemarch.tags = ["polemarch-upgrade"];