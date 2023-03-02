import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { assert, expect } from "chai";
import { network, deployments, ethers, upgrades } from "hardhat";
import { TestEnv, createTestEnv, WETH_DECIMALS } from "./setup";
import { makeLineOfCredit, makeDaoVoters, makeLocProposal } from "../helpers/contract-helpers";

describe("polemarch-debt", function() {
  let testEnv;

  beforeEach(async () => {
    testEnv = await createTestEnv();
  });

  describe("debt-service create-line-of-credit", () => {
    it("reverts when a borrowMax is not greater than 0", async () => {
      const { polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await expect(makeLineOfCredit(testEnv, proposalDescription, "10.0", borrowerIndex, 0,  "0.0", "20.0", 14))
        .to.be.revertedWith("TimelockController: underlying transaction reverted");
    });

    it("reverts createLineOfCredit when exchequer is inactive", async () => {
      const { users, polemarch, weth, sWETH, dWETH, thurmanGov } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await makeDaoVoters(testEnv, "10.0");
      const { locCallData, proposalId } = await makeLocProposal(
        testEnv,
        "10.0",
        "20.0",
        14,
        borrowerIndex,
        0,
        proposalDescription
      );

      await hre.network.provider.send("hardhat_mine", ["0x19C8"]);
      
      await thurmanGov.castVote(proposalId, 1);
      for (let i = 0; i < users.length; i++) {
        await thurmanGov.connect(users[i]).castVote(proposalId, 1);
      }

      await hre.network.provider.send("hardhat_mine", ["0xB3E2"]);

      let descriptionHash = ethers.utils.id(proposalDescription);
      await thurmanGov["queue(address[],uint256[],bytes[],bytes32)"](
        [polemarch.address],
        [0],
        [locCallData],
        descriptionHash
      );

      await polemarch.setExchequerActive(weth.address, false);

      await hre.network.provider.send("hardhat_mine", ["0x19B4"]);

      await expect(thurmanGov["execute(address[],uint256[],bytes[],bytes32)"](
        [polemarch.address],
        [0],
        [locCallData],
        descriptionHash
      )).to.be.revertedWith("TimelockController: underlying transaction reverted");
    });

    it("reverts when the borrowMax is larger than the underlying asset balance", async () => {
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { polemarch, weth, sWETH, dWETH } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await expect(makeLineOfCredit(testEnv, proposalDescription, "1.0", borrowerIndex, 0, "50.0", "20.0", 14))
        .to.be.revertedWith("TimelockController: underlying transaction reverted");
    });

    it("reverts when the borrowMax leads pushes total debt over the borrow cap", async () => {
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { polemarch, weth, sWETH, dWETH } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await polemarch.setBorrowCap(weth.address, parseEther("0.25"));
      await expect(makeLineOfCredit(testEnv, proposalDescription, "1.0", borrowerIndex, 0, "5.0", "20.0", 14))
        .to.be.revertedWith("TimelockController: underlying transaction reverted");
    });

    it("reverts when a user already has an open line of credit", async () => {
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { users, polemarch, weth, sWETH, dWETH, thurmanGov } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(testEnv, proposalDescription, "10.0", borrowerIndex, 0, "10.0", "20.0", 14);
      
      await hre.network.provider.send("hardhat_mine", ["0xB3E2"]);
      const proposalDescription2 = `Proposal #2: Create a line of credit for User #${borrowerIndex};`

      const eventIndex = 1;
      await expect(makeLineOfCredit(testEnv, proposalDescription2, "1.0", borrowerIndex, eventIndex, "10.0", "20.0", 14))
        .to.be.revertedWith("TimelockController: underlying transaction reverted");
    });

    it("reverts when attempting to create a line of credit for a deliquent borrower", async () => {
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(testEnv, proposalDescription, "10.0", borrowerIndex, eventIndex, "10.0", "20.0", 14);
      await polemarch.connect(users[5]).borrow(weth.address, parseEther("1.0"));
      await ethers.provider.send('evm_increaseTime', [15 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await polemarch.markDelinquent(weth.address, users[5].address);

      const proposalDescription2 = `Proposal #2: Create a line of credit for User #${borrowerIndex};`
      const eventIndex2 = 1;
      await expect(makeLineOfCredit(
        testEnv, 
        proposalDescription2, 
        "10.0", 
        borrowerIndex, 
        eventIndex2, 
        "10.0", 
        "20.0", 
        14
      ))
        .to.be.revertedWith("TimelockController: underlying transaction reverted");
    });

    it("emits a createLineOfCredit event", async () => {
      const { polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      expect(await makeLineOfCredit(testEnv, proposalDescription, "10.0", borrowerIndex, eventIndex, "10.0", "20.0", 14))
        .to.emit(polemarch, "CreateLineOfCredit");
    })
  });

  describe("debt-service borrow", () => {
    it("reverts if user attempts to borrow zero", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      await expect(polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0")))
        .to.be.revertedWith("INVALID_AMOUNT");
    });

    it("reverts when the exchequer is not active", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      await polemarch.setExchequerActive(weth.address, false);
      await expect(polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.1")))
        .to.be.revertedWith("EXCHEQUER_INACTIVE");
    });

    it("reverts when borrowing is not enables", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      await polemarch.setExchequerBorrowing(weth.address, false);
      await expect(polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.1")))
        .to.be.revertedWith("BORROWING_NOT_ENABLED");
    });

    it("reverts when a user does not have a line of credit", async () => {
      const { polemarch, weth, sWETH, dWETH } = testEnv;
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await expect(polemarch.borrow(weth.address, parseEther("0.1"))).to.be.revertedWith(
        "USER_DOES_NOT_HAVE_LINE_OF_CREDIT"
      );
    });

    it("reverts when a user tries to borrow over their borrowMax", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.1"));
      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("10.0")))
        .to.be.revertedWith("USER_CANNOT_BORROW_OVER_MAX_LIMIT");
    });

    it("reverts when the line of credit expiration time has passed", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.1"));
      await ethers.provider.send('evm_increaseTime', [15 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.1")))
        .to.be.revertedWith("LINE_OF_CREDIT_EXPIRED");
    });

    it("reverts when a line of credit is delinquent", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("5.0"));
      await ethers.provider.send('evm_increaseTime', [15 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await polemarch.markDelinquent(weth.address, users[borrowerIndex].address);
      await expect(polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.02")))
        .to.be.revertedWith("USER_HAS_DELIQUENT_DEBT");
    });

    it("emits a borrow event", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      const loc: Types.LineOfCreditStruct = await polemarch.getLineOfCredit(users[borrowerIndex].address);
      const rate = await dWETH.userRate(users[borrowerIndex].address);
      await expect(polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.04")))
        .to.emit(polemarch, "Borrow")
        .withArgs(loc.id, rate, users[borrowerIndex].address, weth.address, parseEther("0.04")
      );
    })
  });

  describe("debt-service repay", () => {
    it("reverts when a user attempts to repay zero", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [2 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.connect(users[borrowerIndex]).repay(weth.address, parseEther("0")))
        .to.be.revertedWith("INVALID_AMOUNT");
    });

    it("reverts repay when the exchequer is inactive", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [2 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await polemarch.setExchequerActive(weth.address, false);
      await expect(polemarch.connect(users[borrowerIndex]).repay(weth.address, parseEther("0.05")))
        .to.be.revertedWith("EXCHEQUER_INACTIVE");
    });

    it("reverts repay when the user does not have a line of credit", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await expect(polemarch.repay(weth.address, parseEther("0.05"))).to.be.revertedWith(
        "USER_DOES_NOT_HAVE_LINE_OF_CREDIT"
      );
    });

    it("reverts repay when the expiration date has passed", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [15 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.connect(users[borrowerIndex]).repay(weth.address, parseEther("0.05")))
        .to.be.revertedWith("LINE_OF_CREDIT_EXPIRED");
    });

    it("reverts repay when the user debt is delinquent", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [15 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await polemarch.markDelinquent(weth.address, users[borrowerIndex].address);
      await expect(polemarch.connect(users[borrowerIndex]).repay(weth.address, parseEther("0.05")))
        .to.be.revertedWith("USER_DEBT_IS_DELIQUENT");
    });

    it("emits a repay event", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.05"));
      const loc: Types.LineOfCreditStruct = await polemarch.getLineOfCredit(users[borrowerIndex].address);
      await weth.connect(users[borrowerIndex]).approve(polemarch.address, parseEther("0.05"));
      await expect(polemarch.connect(users[borrowerIndex]).repay(weth.address, parseEther("0.04")))
        .to.emit(polemarch, "Repay")
        .withArgs(loc.id, users[borrowerIndex].address, weth.address, parseEther("0.04")
      );
    });
  });

  describe("debt-service mark-delinquent", () => {
    it("reverts when a line of credit has not expired", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "10.0", 
        borrowerIndex, 
        eventIndex, 
        "10.0", 
        "20.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [13 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.connect(users[0]).markDelinquent(weth.address, users[borrowerIndex].address))
        .to.be.revertedWith(
          "LINE_OF_CREDIT_HAS_NOT_EXPIRED"
      );
    });

    it("reverts when the user balance is zero", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "2.5", 
        borrowerIndex, 
        eventIndex, 
        "5.0", 
        "2.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.025"));
      await ethers.provider.send('evm_increaseTime', [13 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      let dWETHBalance = await dWETH.balanceOf(users[borrowerIndex].address);
      await weth.connect(users[borrowerIndex]).deposit({ value: parseEther("2.0") });
      await weth.connect(users[borrowerIndex]).approve(polemarch.address, dWETHBalance);
      await polemarch.connect(users[borrowerIndex]).repay(weth.address, dWETHBalance);

      // get rid of dust
      dWETHBalance = await dWETH.balanceOf(users[borrowerIndex].address)
      await weth.connect(users[borrowerIndex]).approve(polemarch.address, dWETHBalance);
      await polemarch.connect(users[borrowerIndex]).repay(weth.address, dWETHBalance);

      await ethers.provider.send('evm_increaseTime', [2 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      
      await expect(polemarch.connect(users[0]).markDelinquent(weth.address, users[borrowerIndex].address))
        .to.be.revertedWith(
          "USER_DEBT_BALANCE_IS_ZERO"
      );
    });

    it("emits a delinquent event", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "2.5", 
        borrowerIndex, 
        eventIndex, 
        "5.0", 
        "2.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.05"));
      const loc: Types.LineOfCreditStruct = await polemarch.getLineOfCredit(users[borrowerIndex].address);
      await ethers.provider.send('evm_increaseTime', [15 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      const dWETHBalance = await dWETH.balanceOf(users[borrowerIndex].address);
      await expect(polemarch.connect(users[0]).markDelinquent(weth.address, users[borrowerIndex].address))
        .to.emit(polemarch, "Delinquent");
    });
  });

  describe("debt-service close-line-of-credit", () => {
    it("reverts when user has a deliquent line of credit", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "2.5", 
        borrowerIndex, 
        eventIndex, 
        "5.0", 
        "2.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [15 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await polemarch.connect(users[0]).markDelinquent(weth.address, users[borrowerIndex].address);
      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.connect(users[1]).closeLineOfCredit(weth.address, users[borrowerIndex].address))
        .to.be.revertedWith(
          "USER_DEBT_IS_DELIQUENT"
        );
    });

    it("reverts when a line of credit has not yet expired", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "2.5", 
        borrowerIndex, 
        eventIndex, 
        "5.0", 
        "2.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [13 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.connect(users[1]).closeLineOfCredit(weth.address, users[borrowerIndex].address))
        .to.be.revertedWith(
          "LINE_OF_CREDIT_HAS_NOT_EXPIRED"
        );
    });

    it("reverts when a line of credit has greater than zero balance", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "2.5", 
        borrowerIndex, 
        eventIndex, 
        "5.0", 
        "2.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [13 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await weth.connect(users[borrowerIndex]).deposit({ value: parseEther("0.05") });
      await weth.connect(users[borrowerIndex]).approve(polemarch.address, parseEther("0.05"));
      await polemarch.connect(users[borrowerIndex]).repay(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [2 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.connect(users[1]).closeLineOfCredit(weth.address, users[borrowerIndex].address))
        .to.be.revertedWith(
          "USER_DEBT_BALANCE_IS_NOT_ZERO"
        );
    });

    it("emits close line of credit event", async () => {
      const { users, polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      const eventIndex: number = 0;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await makeLineOfCredit(
        testEnv, 
        proposalDescription, 
        "2.5", 
        borrowerIndex, 
        eventIndex, 
        "5.0", 
        "2.0", 
        14
      );
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("0.025"));
      await ethers.provider.send('evm_increaseTime', [13 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      let dWETHBalance = await dWETH.balanceOf(users[borrowerIndex].address);
      await weth.connect(users[borrowerIndex]).deposit({ value: parseEther("2.0") });
      await weth.connect(users[borrowerIndex]).approve(polemarch.address, dWETHBalance);
      await polemarch.connect(users[borrowerIndex]).repay(weth.address, dWETHBalance);

      // get rid of dust
      dWETHBalance = await dWETH.balanceOf(users[borrowerIndex].address)
      await weth.connect(users[borrowerIndex]).approve(polemarch.address, dWETHBalance);
      await polemarch.connect(users[borrowerIndex]).repay(weth.address, dWETHBalance);

      const loc: Types.LineOfCreditStruct = await polemarch.getLineOfCredit(users[borrowerIndex].address);

      await ethers.provider.send('evm_increaseTime', [2 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.connect(users[0]).closeLineOfCredit(weth.address, users[borrowerIndex].address))
        .to.emit(polemarch, "CloseLineOfCredit")
        .withArgs(
          loc.id,
          users[borrowerIndex].address,
          weth.address,
          loc.expirationTimestamp
        );
    })
  });
});