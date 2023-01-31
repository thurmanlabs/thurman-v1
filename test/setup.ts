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
}

export const testEnv: TestEnv = {
  deployer: {} as SignerWithAddress,
  users: [] as SignerWithAddress[],
  polemarch: {} as Polemarch,
  weth: {} as WETH9,
  sWETH: {} as SToken,
  dWETH: {} as DToken,
} as TestEnv;

export async function createTestEnv(): TestEnv {
  let polemarch: Polemarch;
  let weth: WETH9;
  let sWETH: SToken;
  let dWETH: DToken;

  const [deployer, ...users] = await ethers.getSigners();
  const Weth = await ethers.getContractFactory("WETH9");
  weth = await Weth.deploy();
  const Polemarch = await ethers.getContractFactory("Polemarch");
  polemarch = await upgrades.deployProxy(Polemarch, []);
  await polemarch.deployed()
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

  testEnv.deployer = deployer;
  testEnv.users = users;
  testEnv.polemarch = polemarch;
  testEnv.weth = weth
  testEnv.sWETH = sWETH;
  testEnv.dWETH = dWETH;
  return testEnv;
}