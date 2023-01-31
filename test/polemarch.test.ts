import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { assert, expect } from "chai";
import { network, deployments, ethers, upgrades } from "hardhat";
import { TestEnv, createTestEnv, WETH_DECIMALS } from "./setup";

describe("Polemarch", function() {
  let deployer: SignerWithAddress;
  let users: SignerWithAddress[];
  let polemarch: Polemarch;
  let weth: WETH9;
  let sWETH: SToken;
  let dWETH: DToken;

  beforeEach(async () => {
    const testEnv: TestEnv = await createTestEnv();
    deployer = testEnv.deployer;
    users = testEnv.users;
    polemarch = testEnv.polemarch;
    weth = testEnv.weth;
    sWETH = testEnv.sWETH;
    dWETH = testEnv.dWETH;
  });

  describe("exchequer", () => {
    
    it("adds an exchequer correctly", async () => {
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      let exchequer: Types.ExchequerStruct = await polemarch.getExchequer(weth.address);
      expect(exchequer.sTokenAddress).to.equal(sWETH.address);
      expect(exchequer.dTokenAddress).to.equal(dWETH.address);
    });

    it("deletes an exchequer correctly", async () => {
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await polemarch.deleteExchequer(weth.address);
      let exchequer: Types.ExchequerStruct = await polemarch.getExchequer(weth.address);
      expect(exchequer.sTokenAddress).to.equal(ethers.constants.AddressZero)
    })
  });

  describe("supply service", () => {
    it("adds supply to the exchequer", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.3"));
      await polemarch.supply(weth.address, parseEther("0.2"));
      expect(await weth.balanceOf(sWETH.address)).to.equal(parseEther("0.2"));
    });

    it("withdraws supply from the exchequer", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.3"));
      await polemarch.supply(weth.address, parseEther("0.2"));
      await polemarch.withdraw(weth.address, parseEther("0.1"));
      expect(await weth.balanceOf(sWETH.address)).to.equal(parseEther("0.1"));
    });

    it("balance stays the same over time, if no debt positions exist", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.3"));
      await polemarch.supply(weth.address, parseEther("0.2"));
      const balance_0 = await sWETH.balanceOf(deployer.address);
      await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      expect(await sWETH.balanceOf(deployer.address)).to.equal(balance_0);
    })
  });

  describe("debt service", () => {
    it("adds line of credit", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.3"));
      await polemarch.supply(weth.address, parseEther("0.2"));
      await polemarch.createLineOfCredit(
        deployer.address,
        weth.address,
        parseEther("0.05"),
        parseEther("0.05"), 
        14
      );
      let lineOfCredit: Types.LineOfCreditStruct = await polemarch.getLineOfCredit(deployer.address);
      expect(lineOfCredit.borrowMax).to.equal(parseEther("0.05"));
    });

    it("borrows from line of credit", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.3"));
      await polemarch.supply(weth.address, parseEther("0.2"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address,
        weth.address,
        parseEther("0.05"),
        parseEther("0.05"), 
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.01"));
      expect(await weth.balanceOf(deployer.address)).to.equal(parseEther("0.31"));
      expect(await dWETH.balanceOf(deployer.address)).to.equal(parseEther("0.01"));
    })

    it("accrues interest after borrow", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.3"));
      await polemarch.supply(weth.address, parseEther("0.2"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address,
        weth.address,
        parseEther("0.05"),
        parseEther("0.05"), 
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.01"));
      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      expect(await dWETH.balanceOf(deployer.address)).to.be.gt(parseEther("0.01"));
    })

    it("repays after accrues interest", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.3"));
      await polemarch.supply(weth.address, parseEther("0.2"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address,
        weth.address,
        parseEther("0.05"),
        parseEther("0.05"), 
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.01"));
      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      const newBalance = await dWETH.balanceOf(deployer.address);
      await polemarch.repay(weth.address, newBalance);
      expect(await dWETH.balanceOf(deployer.address)).to.equal(parseEther("0.0"));
    });

    it("liquidity index changes", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.3"));
      await polemarch.supply(weth.address, parseEther("0.2"));
      let exchequer_0: Types.ExchequerStruct = await polemarch.getExchequer(weth.address);
      const supplyIndex_0 = exchequer_0.supplyIndex;
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address,
        weth.address,
        parseEther("0.05"),
        parseEther("0.05"), 
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.01"));
      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await polemarch.supply(weth.address, parseEther("0.05"))
      let exchequer_1: Types.ExchequerStruct = await polemarch.getExchequer(weth.address);
      const supplyIndex_1 = exchequer_1.supplyIndex;
      expect(supplyIndex_0).to.equal(ethers.utils.parseUnits("1", 27));
      expect(supplyIndex_1).to.be.gt(supplyIndex_0);
    });

    it("user sWETH and dWETH increase over time", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.3"));
      await polemarch.supply(weth.address, parseEther("0.2"));
      const sWETHBalance_0 = await sWETH.balanceOf(deployer.address);
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address,
        weth.address,
        parseEther("0.05"),
        parseEther("0.05"), 
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.01"));
      const dWETHBalance_0 = await dWETH.balanceOf(deployer.address);
      await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      expect(await sWETH.balanceOf(deployer.address)).to.be.gt(sWETHBalance_0);
      expect(await dWETH.balanceOf(deployer.address)).to.be.gt(dWETHBalance_0);
    })
  });
})