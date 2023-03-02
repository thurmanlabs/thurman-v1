import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";

export const WETH_DECIMALS = 18;
export const USDC_DECIMALS = 6;

export interface TestEnv {
  deployer: SignerWithAddress;
  users: SignerWithAddress[];
  polemarch: Polemarch;
  weth: WETH9;
  sWETH: SToken;
  dWETH: DToken;
  thurman: ThurmanToken;
  timelock: ThurmanTimelock;
  thurmanGov: ThurmanGovernor;
}

export const testEnv: TestEnv = {
  deployer: {} as SignerWithAddress,
  users: [] as SignerWithAddress[],
  polemarch: {} as Polemarch,
  weth: {} as WETH9,
  sWETH: {} as SToken,
  dWETH: {} as DToken,
  thurman: {} as ThurmanToken,
  timelock: {} as ThurmanTimelock,
  thurmanGov: {} as ThurmanGovernor,
} as TestEnv;

export async function createTestEnv(): TestEnv {
  let polemarch: Polemarch;
  let weth: WETH9;
  let sWETH: SToken;
  let dWETH: DToken;
  let thurman: ThurmanToken;
  let timelock: ThurmanTimelock;
  let thurmanGov: ThurmanGovernor;

  const [deployer, ...users] = await ethers.getSigners();
  const Weth = await ethers.getContractFactory("WETH9");
  weth = await Weth.deploy();
  const Polemarch = await ethers.getContractFactory("Polemarch");
  polemarch = await upgrades.deployProxy(Polemarch, []);
  await polemarch.deployed();
  
  const SToken = await ethers.getContractFactory("SToken");
  sWETH = await upgrades.deployProxy(SToken, [
    polemarch.address,
    "sWETH",
    "S_WETH",
    WETH_DECIMALS,
    deployer.address,
    weth.address,
  ]);
  await sWETH.deployed();

  const DToken = await ethers.getContractFactory("DToken");
  dWETH = await upgrades.deployProxy(DToken, [
    polemarch.address,
    "dWETH",
    "D_WETH",
    WETH_DECIMALS,
    deployer.address,
    weth.address,
  ]);
  await dWETH.deployed();

  const Thurman = await ethers.getContractFactory("ThurmanToken");
  thurman = await upgrades.deployProxy(Thurman, [
    polemarch.address,
    "thurman",
    "THURM",
    WETH_DECIMALS,
  ]);
  await thurman.deployed();

  const Timelock = await ethers.getContractFactory("ThurmanTimelock");
  timelock = await upgrades.deployProxy(Timelock, [
    6575,
    [deployer.address],
    [deployer.address],
    deployer.address,
  ]);
  await timelock.deployed();

  const ThurmanGov = await ethers.getContractFactory("ThurmanGovernor");
  thurmanGov = await upgrades.deployProxy(ThurmanGov, [
    thurman.address,
    timelock.address,
    "ThurmanDAO",
  ]);
  await thurmanGov.deployed();

  await timelock.grantRole(ethers.utils.id("TIMELOCK_ADMIN_ROLE"), thurmanGov.address);
  await timelock.grantRole(ethers.utils.id("PROPOSER_ROLE"), thurmanGov.address);
  await timelock.grantRole(ethers.utils.id("EXECUTOR_ROLE"), thurmanGov.address);

  await polemarch.setThurmanToken(thurman.address);
  await polemarch.setTimelock(timelock.address);

  // testEnv.deployer = deployer;
  // testEnv.users = users;
  // testEnv.polemarch = polemarch;
  // testEnv.weth = weth
  // testEnv.sWETH = sWETH;
  // testEnv.dWETH = dWETH;
  // testEnv.thurman = thurman;
  // testEnv.timelock = timelock;
  // testEnv.thurmanGov = thurmanGov;
  // return testEnv;
  return {
    deployer,
    users,
    polemarch,
    weth,
    sWETH,
    dWETH,
    thurman,
    timelock,
    thurmanGov
  };
}