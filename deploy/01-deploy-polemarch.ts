import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { verify } from "../utils/verify";
import { upgrades } from "hardhat";
import usdcGoerli from "../abi/usdc-abi.json";
import usdcSepolia from "../abi/usdc-sepolia-abi.json";
import usdcMainnet from "../abi/usdc-mainnet-abi.json";


const USDC_ADDRESS_GOERLI = "0x07865c6E87B9F70255377e024ace6630C1Eaa37F";
const USDC_ADDRESS_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const USDC_ADDRESS_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_DECIMALS = 18;
const USDC_DECIMALS = 6;

interface IDeployConfig {
  [key: string]: {
    timelockMinDelay: number;
    govVotingDelay: number;
    govVotingPeriod: number;
    govProposalThreshold: number;
  };
}

const deployConfig: IDeployConfig = {
  "mainnet": {
    timelockMinDelay: 7200,
    govVotingDelay: 7200,
    govVotingPeriod: 50400,
    govProposalThreshold: 0,
  },
  "goerli": {
    timelockMinDelay: 0,
    govVotingDelay: 0,
    govVotingPeriod: 40,
    govProposalThreshold: 0,
  },
  "sepolia": {
    timelockMinDelay: 0,
    govVotingDelay: 0,
    govVotingPeriod: 40,
    govProposalThreshold: 0,
  },
  "hardhat": {
    timelockMinDelay: 0,
    govVotingDelay: 0,
    govVotingPeriod: 40,
    govProposalThreshold: 0,
  }
};

const developmentChains = ["hardhat", "localhost"];

const deployPool: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  let polemarch: Polemarch;
  let weth: WETH9;
  let wethAddress: string;
  let usdcAddress: string;
  let usdcAbi: any;
  let sWETH: SToken;
  let dWETH: DToken;
  let gWETH: GToken;
  let sUSDC: SToken;
  let dUSDC: DToken;
  let gUSDC: GToken;
  let thurman: ThurmanToken;
  let timelock: ThurmanTimelock;
  let thurmanGov: ThurmanGovernor;

  const { deployments, network } = hre;
  const { deploy, log } = deployments;
  const [deployer, ...users]: SignerWithAddress[] = await ethers.getSigners();
  console.log("deployer address: ", deployer.address);
  const chainId: number = network.config.chainId!;

  log("------------------------------------------");
  log("Deploying Polemarch...");

  const Polemarch = await ethers.getContractFactory("Polemarch");
  polemarch = await upgrades.deployProxy(Polemarch, []);
  await polemarch.deployTransaction.wait(1);
  log(`[polemarch address]: ${polemarch.address}`);
  const SToken = await ethers.getContractFactory("SToken");
  const DToken = await ethers.getContractFactory("DToken");
  const GToken = await ethers.getContractFactory("GToken");

  if (developmentChains.includes(network.name)) {
    log("Creating a new instance of WETH9 contract with deployer");
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

  } else {
    log("Creating a new instance of USDC contract with deployer");

    if (network.name === "mainnet") {
      log("mainnet USDC config");
      usdcAddress = USDC_ADDRESS_MAINNET;
      usdcAbi = usdcMainnet.abi;
    } 

    if (network.name === "goerli") {
      log("goerli USDC config");
      usdcAddress = USDC_ADDRESS_GOERLI;
      usdcAbi = usdcGoerli.abi;
    }

    if (network.name === "sepolia") {
      log("sepolia USDC config");
      usdcAddress = USDC_ADDRESS_SEPOLIA;
      usdcAbi = usdcSepolia.abi;
    }

    const usdc = await new ethers.Contract(
      usdcAddress,
      usdcAbi,
      deployer
    );

    sUSDC = await upgrades.deployProxy(SToken, [
      polemarch.address,
      "sUSDC",
      "S_USDC",
      USDC_DECIMALS,
      deployer.address,
      usdcAddress,
    ]);
    await sUSDC.deployTransaction.wait(1);

    dUSDC = await upgrades.deployProxy(DToken, [
      polemarch.address,
      "dUSDC",
      "D_USDC",
      USDC_DECIMALS,
      deployer.address,
      usdcAddress,
    ]);
    await dUSDC.deployTransaction.wait(1);

    gUSDC = await upgrades.deployProxy(GToken, [
      polemarch.address,
      "gUSDC",
      "G_USDC",
      USDC_DECIMALS,
      deployer.address,
      usdcAddress,
    ]);
    await gUSDC.deployTransaction.wait(1);

    log("adding exchequer to the polemarch");

    const tx = await polemarch.addExchequer(
      usdc.address, 
      sUSDC.address, 
      dUSDC.address, 
      gUSDC.address, 
      USDC_DECIMALS, 
      parseEther("0.05")
    );
    await tx.wait();
    let exchequer: Types.ExchequerStruct = await polemarch.getExchequer(usdc.address);
    log(`usdc exchequer: ${exchequer}`);
  }

  log("----------------------------------------------");

  const Thurman = await ethers.getContractFactory("ThurmanToken");
  
  let decimals: number;
  if (developmentChains.includes(network.name)) {
    decimals = WETH_DECIMALS;
  } else {
    decimals = USDC_DECIMALS;
  }

  thurman = await upgrades.deployProxy(Thurman, [
    polemarch.address,
    "thurman",
    "THURM",
    decimals,
  ]);
  await thurman.deployTransaction.wait(1);

  const Timelock = await ethers.getContractFactory("ThurmanTimelock");
  timelock = await upgrades.deployProxy(Timelock, [
    deployConfig[network.name].timelockMinDelay,
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
    deployConfig[network.name].govVotingDelay,
    deployConfig[network.name].govVotingPeriod,
    deployConfig[network.name].govProposalThreshold
  ]);
  await thurmanGov.deployTransaction.wait(1);

  await timelock.grantRole(ethers.utils.id("TIMELOCK_ADMIN_ROLE"), thurmanGov.address);
  await timelock.grantRole(ethers.utils.id("PROPOSER_ROLE"), thurmanGov.address);
  await timelock.grantRole(ethers.utils.id("EXECUTOR_ROLE"), thurmanGov.address);

  await polemarch.setThurmanToken(thurman.address);
  await polemarch.setTimelock(timelock.address);
  log(`Completed development ${network.name} chain deployment`);

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(polemarch.address, []);
    await verify(sUSDC.address, []);
    await verify(dUSDC.address, []);
    await verify(gUSDC.address, []);
    await verify(thurman.address, []);
    await verify(timelock.address, []);
    await verify(thurmanGov.address, []);
  } 
};

export default deployPool;
deployPool.tags = ["all", "pool"];