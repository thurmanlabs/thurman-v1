import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { assert, expect } from "chai";
import { network, deployments, ethers, upgrades } from "hardhat";
import { TestEnv, createTestEnv, WETH_DECIMALS } from "./setup";
import { makeLineOfCredit } from "../helpers/contract-helpers";

describe("Polemarch", function() {
  let testEnv: TestEnv;

  beforeEach(async () => {
    testEnv = await createTestEnv();

  });

  describe("exchequer", () => {
    
    it("adds an exchequer correctly", async () => {
      const { polemarch, weth, sWETH, dWETH } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS, parseEther("0.05");
      let exchequer: Types.ExchequerStruct = await polemarch.getExchequer(weth.address);
      expect(exchequer.sTokenAddress).to.equal(sWETH.address);
      expect(exchequer.dTokenAddress).to.equal(dWETH.address);
    });

    it("deletes an exchequer correctly", async () => {
      const { polemarch, weth, sWETH, dWETH } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS, parseEther("0.05");
      await polemarch.deleteExchequer(weth.address);
      let exchequer: Types.ExchequerStruct = await polemarch.getExchequer(weth.address);
      expect(exchequer.sTokenAddress).to.equal(ethers.constants.AddressZero)
    })
  });

  describe("supply service", () => {
    it("adds supply to the exchequer", async () => {
      const { polemarch, weth, sWETH, dWETH } = testEnv;
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS, parseEther("0.05");
      await weth.approve(polemarch.address, parseEther("0.3"));
      await polemarch.supply(weth.address, parseEther("0.2"));
      expect(await weth.balanceOf(sWETH.address)).to.equal(parseEther("0.2"));
    });

    it("withdraws supply from the exchequer", async () => {
      const { polemarch, weth, sWETH, dWETH } = testEnv;
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS, parseEther("0.05");
      await weth.approve(polemarch.address, parseEther("0.3"));
      await polemarch.supply(weth.address, parseEther("0.2"));
      await polemarch.withdraw(weth.address, parseEther("0.1"));
      expect(await weth.balanceOf(sWETH.address)).to.equal(parseEther("0.1"));
    });

    it("balance stays the same over time, if no debt positions exist", async () => {
      const { deployer, polemarch, weth, sWETH, dWETH } = testEnv;
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS, parseEther("0.05");
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
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS, parseEther("0.05");
      await makeLineOfCredit(testEnv, proposalDescription, "1.0", borrowerIndex, 0, "5.0", "20.0", 14);
      let lineOfCredit: Types.LineOfCreditStruct = await polemarch.getLineOfCredit(users[borrowerIndex].address);
      expect(lineOfCredit.borrowMax).to.equal(parseEther("5.0"));
    });

    it("borrows from line of credit", async () => {
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS, parseEther("0.05");
      await makeLineOfCredit(testEnv, proposalDescription, "1.0", borrowerIndex, 0, "5.0", "20.0", 14);
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.5"));
      expect(await weth.balanceOf(users[borrowerIndex].address)).to.equal(parseEther("0.5"));
    })

    it("accrues interest after borrow", async () => {
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS, parseEther("0.05");
      await makeLineOfCredit(testEnv, proposalDescription, "1.0", borrowerIndex, 0, "5.0", "20.0", 14);
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.5"));
      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      expect(await dWETH.balanceOf(users[borrowerIndex].address)).to.be.gt(parseEther("0.5"));
    })
    // STARTING POINT TO PICK UP TESTING
    it("repays after accrues interest", async () => {
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS, parseEther("0.05");
      await makeLineOfCredit(testEnv, proposalDescription, "1.0", borrowerIndex, 0, "5.0", "20.0", 14);
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.5"));
      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      
      let newBalance = await dWETH.balanceOf(users[borrowerIndex].address);
      await weth.connect(users[borrowerIndex]).deposit({ value: parseEther("5.0") });
      await weth.connect(users[borrowerIndex]).approve(polemarch.address, newBalance);
      await polemarch.connect(users[borrowerIndex]).repay(weth.address, newBalance);

      newBalance = await dWETH.balanceOf(users[borrowerIndex].address);
      await weth.connect(users[borrowerIndex]).approve(polemarch.address, newBalance);
      await polemarch.connect(users[borrowerIndex]).repay(weth.address, newBalance);
      expect(await dWETH.balanceOf(users[borrowerIndex].address)).to.equal(parseEther("0.0"));
    });

    it("liquidity index changes", async () => {
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS, parseEther("0.05");
      await makeLineOfCredit(testEnv, proposalDescription, "1.0", borrowerIndex, 0, "5.0", "20.0", 14);
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.5"));
      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      let exchequer_0: Types.ExchequerStruct = await polemarch.getExchequer(weth.address);
      const supplyIndex_0 = exchequer_0.supplyIndex;

      await weth.deposit({ value: parseEther("0.5") });
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.05"))
      let exchequer_1: Types.ExchequerStruct = await polemarch.getExchequer(weth.address);
      const supplyIndex_1 = exchequer_1.supplyIndex;
      expect(supplyIndex_0).to.equal(ethers.utils.parseUnits("1", 27));
      expect(supplyIndex_1).to.be.gt(supplyIndex_0);
    });

    it("user sWETH and dWETH increase over time", async () => {
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { deployer, users, polemarch, weth, sWETH, dWETH } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS, parseEther("0.05");
      await makeLineOfCredit(testEnv, proposalDescription, "1.0", borrowerIndex, 0, "5.0", "20.0", 14);

      await weth.deposit({ value: parseEther("0.5") });
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      const sWETHBalance_0 = await sWETH.balanceOf(deployer.address);
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.01"));
      const dWETHBalance_0 = await dWETH.balanceOf(users[borrowerIndex].address);
      await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      expect(await sWETH.balanceOf(deployer.address)).to.be.gt(sWETHBalance_0);
      expect(await dWETH.balanceOf(users[borrowerIndex].address)).to.be.gt(dWETHBalance_0);
    });

    it("interest accrues correctly", async () => {
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { deployer, users, polemarch, weth, sWETH, dWETH } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS, parseEther("0.05"));
      await makeLineOfCredit(testEnv, proposalDescription, "1.0", borrowerIndex, 0, "5.0", "1.0", 366);
      let lineOfCredit: Types.LineOfCreditStruct = await polemarch.getLineOfCredit(users[borrowerIndex].address);
      console.log(lineOfCredit);
      
      let deployerBalance = await sWETH.balanceOf(deployer.address);
      console.log(formatEther(deployerBalance));
      
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("4.5"));

      let totalDebtSupply = await dWETH.totalSupply();
      console.log("total debt supply: ", formatEther(totalDebtSupply));

      await ethers.provider.send('evm_increaseTime', [365 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');

      let dWETHBalance = await dWETH.balanceOf(users[borrowerIndex].address);
      console.log(formatEther(dWETHBalance));
      let avgRate = await dWETH.getAverageRate();
      console.log("average rate: ", ethers.utils.formatUnits(avgRate, 27));
      totalDebtSupply = await dWETH.totalSupply();
      console.log("total debt supply: ", formatEther(totalDebtSupply));
      let userBalance = await sWETH.balanceOf(users[1].address);
      console.log(formatEther(userBalance));
      console.log(users.length)
    })
  });
})