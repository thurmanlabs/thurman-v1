import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { assert, expect } from "chai";
import { network, deployments, ethers, upgrades } from "hardhat";
import { TestEnv, createTestEnv, WETH_DECIMALS } from "./setup";

describe("sToken", function() {
  let deployer: SignerWithAddress;
  let users: SignerWithAddress[];
  let polemarch: Polemarch;
  let weth: WETH9;
  let sWETH: SToken;
  let dWETH: DToken;
  let thurman: ThurmanToken;

  beforeEach(async () => {
    const testEnv: TestEnv = await createTestEnv();
    deployer = testEnv.deployer;
    users = testEnv.users;
    polemarch = testEnv.polemarch;
    weth = testEnv.weth;
    sWETH = testEnv.sWETH;
    dWETH = testEnv.dWETH;
    thurman = testEnv.thurman;
  });

  describe("erc20 base", () => {
    it("returns decimals", async () => {
      const decimals = await sWETH.decimals();
      expect(decimals).to.equal(WETH_DECIMALS);
    });
  });

  describe("scaledTokenBalance", () => {
    it("returns the last update timestamp for sToken", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      const previousIndex = await sWETH.getPreviousIndex(deployer.address);
      const polemarchIndex = await polemarch.getNormalizedReturn(weth.address);
      expect(previousIndex).to.equal(polemarchIndex);
    });

    it("mints when balance increase is larger than burn amount", async () => {
      await weth.deposit({ value: parseEther("10.0") });
      await weth.connect(users[1]).deposit({ value: parseEther("10.0")});
      await weth.connect(users[1]).approve(polemarch.address,parseEther("10.0"));
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("5.0"));
      await polemarch.supply(weth.address, parseEther("5.0"));
      const balance_0 = await sWETH.balanceOf(deployer.address);
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        users[1].address, 
        weth.address, 
        parseEther("5.0"), 
        parseEther("0.05"),
        14
      );
      const loc: Types.LineOfCreditStruct = await polemarch.getLineOfCredit(deployer.address);
      await polemarch.connect(users[1]).borrow(weth.address, parseEther("5.0"));
      await ethers.provider.send('evm_increaseTime', [12 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      let dWETHBalance = await dWETH.balanceOf(users[1].address);
      await polemarch.connect(users[1]).repay(weth.address, dWETHBalance);
      await ethers.provider.send('evm_increaseTime', [1 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      dWETHBalance = await dWETH.balanceOf(users[1].address);
      await polemarch.connect(users[1]).repay(weth.address, dWETHBalance);
      await ethers.provider.send('evm_increaseTime', [2 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await polemarch.closeLineOfCredit(weth.address, users[1].address);
      const balance_1 = await sWETH.balanceOf(deployer.address);
      const difference = balance_1 - balance_0 - 10**3 // arbitrary constant substracted to make sure Mint event happens
      const smallerBurn = formatEther(difference.toString());
      await expect(polemarch.withdraw(weth.address, parseEther(smallerBurn)))
        .to.emit(sWETH, "Mint");
    })
  })
});