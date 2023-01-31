import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { verify } from "../utils/verify";
import { upgrades } from "hardhat";
import usdcGoerli from "../abi/usdc-abi.json";
import usdcMainnet from "../abi/usdc-mainnet-abi.json";

const USDC_ADDRESS_GOERLI = "0x07865c6E87B9F70255377e024ace6630C1Eaa37F";
const USDC_ADDRESS_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_DECIMALS = 18;
const USDC_DECIMALS = 6;
const developmentChains = ["hardhat", "localhost"];

const deployPool: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  let polemarch: Polemarch;
  let weth: WETH9;
  let wethAddress: string;
  let usdcAddress: string;
  let usdcAbi: any;
  let sWETH: SToken;
  let dWETH: DToken;
  let sUSDC: SToken;
  let dUSDC: DToken;

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

    const tx = await polemarch.addExchequer(
      weth.address, 
      sWETH.address, 
      dWETH.address, 
      WETH_DECIMALS
    );
    await tx.wait();
    let exchequer: Types.ExchequerStruct = await polemarch.getExchequer(wethAddress);
    log(`weth exchequer: ${exchequer}`);
    log("Completed development chain deployment");
  } else {
    log("Creating a new instance of USDC contract with deployer");

    if (network.name === "mainnet") {
      log("mainnet USDC config");
      usdcAddress = USDC_ADDRESS_MAINNET;
      usdcAbi = usdcMainnet.abi;
    } else {
      log("goerli USDC config");
      usdcAddress = USDC_ADDRESS_GOERLI;
      usdcAbi = usdcGoerli.abi;
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

    log("adding exchequer to the polemarch");

    const tx = await polemarch.addExchequer(
      usdcAddress,
      sUSDC.address,
      dUSDC.address,
      USDC_DECIMALS
    );
    await tx.wait();
    let exchequer: Types.ExchequerStruct = await polemarch.getExchequer(usdc.address);
    log(`usdc exchequer: ${exchequer}`);
  }

  log("----------------------------------------------");

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(polemarch.address, []);
    await verify(sUSDC.address, []);
    await verify(dUSDC.address, []);
  } 
};

export default deployPool;
deployPool.tags = ["all", "pool"];