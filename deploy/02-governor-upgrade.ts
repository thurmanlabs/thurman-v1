import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { verify } from "../utils/verify";
import { upgrades } from "hardhat";

interface IGovernorAddressConfig {
  [key: string]: {
    address: string;
  }
}

interface IUpgradeConfig {
  [key: string]: {
    govVotingDelay: number;
    govVotingPeriod: number;
    govProposalThreshold: number;
  };
}

const governorAddressConfig: IGovernorAddressConfig = {
  "mainnet": {
    address: "0x6518998C230Ceb7A7AD530c7088f0747604C06f5",
  },
  "goerli": {
    address: "0x5D368EBa7e692CbcbD44a85a33Eaf303968c6548"
  }
};

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

const upgradeGovernor: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  let thurmanGov: ThurmanGovernor;
  let thurmanGov2: ThurmanGovernor2;

  const { deployments, network } = hre;
  const { deploy, log } = deployments;
  const [deployer, ...users]: SignerWithAddress[] = await ethers.getSigners();
  console.log("deployer address: ", deployer.address);
  const chainId: number = network.config.chainId!;
  console.log("chainId: ", chainId);

  if (developmentChains.includes(network.name)) {
    let polemarch: Polemarch;
    let weth: WETH9;
    let wethAddress: string;
    let sWETH: SToken;
    let dWETH: DToken;
    let gWETH: GToken;
    let sUSDC: SToken;
    let dUSDC: DToken;
    let gUSDC: GToken;
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

  let thurmanGovAddress: string;
  if (developmentChains.includes(network.name)) {
    thurmanGovAddress = thurmanGov.address;
  } else {
    thurmanGovAddress = governorAddressConfig[network.name].address;
  }

  const currentImplementation = await upgrades.erc1967.getImplementationAddress(thurmanGovAddress);
  log(`The current address of ThurmanGovernor is ${currentImplementation}`);

  const ThurmanGov2 = await ethers.getContractFactory("ThurmanGovernor2");
  thurmanGov2 = await upgrades.upgradeProxy(
    thurmanGovAddress, 
    ThurmanGov2,
    {
      call: {
        fn: "initializeV2", 
        args: [
          upgradeConfig[network.name].govVotingDelay, 
          upgradeConfig[network.name].govVotingPeriod, 
          upgradeConfig[network.name].govProposalThreshold
        ]
      }
    }
  );

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
}

export default upgradeGovernor;
upgradeGovernor.tags = ["governor-upgrade"];