import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { assert, expect } from "chai";
import { network, deployments, ethers, upgrades } from "hardhat";
import { TestEnv, createTestEnv, WETH_DECIMALS } from "./setup";
import { makeLineOfCredit } from "../helpers/contract-helpers";

describe("sToken", function() {
  let testEnv: TestEnv;

  beforeEach(async () => {
    testEnv = await createTestEnv();
  });

  describe("erc20 base", () => {
    it("returns decimals", async () => {
      const { sWETH } = testEnv;
      const decimals = await sWETH.decimals();
      expect(decimals).to.equal(WETH_DECIMALS);
    });
  });

  describe("scaledTokenBalance", () => {
    it("returns the last updated index for sToken", async () => {
      const { deployer, polemarch, weth, sWETH, dWETH, gWETH } = testEnv;
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(
        weth.address, 
        sWETH.address, 
        dWETH.address, 
        gWETH.address, 
        WETH_DECIMALS, 
        parseEther("0.05")
      );
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      const previousIndex = await sWETH.getPreviousIndex(deployer.address);
      const polemarchIndex = await polemarch.getNormalizedReturn(weth.address);
      expect(previousIndex).to.equal(polemarchIndex);
    });

    it("mints when balance increase is larger than burn amount", async () => {
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { deployer, users, polemarch, weth, sWETH, dWETH, gWETH } = testEnv;
      await polemarch.addExchequer(
        weth.address, 
        sWETH.address, 
        dWETH.address, 
        gWETH.address, 
        WETH_DECIMALS, 
        parseEther("0.05")
      );
      await weth.deposit({ value: parseEther("10.0") });
      await weth.approve(polemarch.address, parseEther("10.0"));
      await polemarch.grantSupply(weth.address, parseEther("10.0"));
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "2.5", 
        borrowerIndex, 
        eventIndex, 
        "5.0", 
        "0.2", 
        14
      );

      await weth.deposit({ value: parseEther("10.0") });
      await weth.approve(polemarch.address, parseEther("5.0"));
      await polemarch.supply(weth.address, parseEther("5.0"));
      const balance_0 = await sWETH.balanceOf(deployer.address);

      const loc: Types.LineOfCreditStruct = await polemarch.getLineOfCredit(users[borrowerIndex].address);
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("5.0"));
      await ethers.provider.send('evm_increaseTime', [12 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      let dWETHBalance = await dWETH.balanceOf(users[borrowerIndex].address);
      
      await weth.connect(users[borrowerIndex]).deposit({ value: parseEther("5.0") });
      await weth.connect(users[borrowerIndex]).approve(polemarch.address, dWETHBalance);
      await polemarch.connect(users[borrowerIndex]).repay(weth.address, dWETHBalance);
      await ethers.provider.send('evm_increaseTime', [1 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');

      dWETHBalance = await dWETH.balanceOf(users[borrowerIndex].address);
      await weth.connect(users[borrowerIndex]).approve(polemarch.address, dWETHBalance);
      await polemarch.connect(users[borrowerIndex]).repay(weth.address, dWETHBalance);
      await ethers.provider.send('evm_increaseTime', [2 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await gWETH.approvePolemarch(parseEther("1.0"));
      await polemarch.closeLineOfCredit(weth.address, users[borrowerIndex].address);
      const balance_1 = await sWETH.balanceOf(deployer.address);
      const difference = balance_1 - balance_0 - 10**3 // arbitrary constant substracted to make sure Mint event happens
      const smallerBurn = formatEther(difference.toString());
      await expect(polemarch.withdraw(weth.address, parseEther(smallerBurn)))
        .to.emit(sWETH, "Mint");
    })
  })
});