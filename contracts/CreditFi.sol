// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CreditFi
 * @notice AI-Powered On-Chain Credit Protocol for AI Agents on 0G Chain
 * @dev Agents deposit 0G tokens as collateral, receive an AI-computed credit score
 *      (via 0G Compute oracle), and can borrow against that score. Credit history
 *      events are indexed for permanent storage on 0G Storage. Interest and protocol
 *      fees flow through 0G Pay.
 *
 * Score range : 300 (High-Risk) → 850 (Prime)
 * Base LTV    : 50% at score 300, linearly boosted to 75% at score 850
 * Interest    : 5% APR, accrued continuously, settled on repay
 *
 * @author Cryptoboy_777 · 0G Bridge Buildathon Wave 1
 * @custom:network 0G Chain (chainId 16601 testnet / 16600 mainnet)
 */
contract CreditFi {

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant MAX_LTV              = 75;    // 75% hard ceiling LTV
    uint256 public constant BASE_LTV             = 50;    // 50% LTV at score 300
    uint256 public constant INTEREST_RATE_BPS    = 500;  // 5 % APR (basis points)
    uint256 public constant SECONDS_PER_YEAR     = 365 days;
    uint256 public constant MIN_CREDIT_SCORE     = 300;
    uint256 public constant MAX_CREDIT_SCORE     = 850;
    uint256 public constant INITIAL_SCORE        = 500;  // starter score on register
    uint256 public constant REPAY_SCORE_BOOST    = 20;   // +20 on-time repayment
    uint256 public constant DEFAULT_SCORE_SLASH  = 100;  // -100 on liquidation
    uint256 public constant LIQUIDATOR_REWARD_BP = 500;  // 5% liquidator bonus

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    uint256 public totalDeposited;
    uint256 public totalBorrowed;

    struct Agent {
        uint256 creditScore;       // AI-computed score: 300–850
        uint256 deposited;         // collateral deposited (wei)
        uint256 borrowed;          // active borrow amount (wei)
        uint256 borrowTimestamp;   // unix timestamp of last borrow
        uint256 totalRepaid;       // lifetime repayment amount (wei)
        uint256 defaultCount;      // number of liquidation events
        bool    registered;
    }

    mapping(address => Agent) public agents;
    address[] public agentList;

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a new agent registers
    event AgentRegistered(address indexed agent, uint256 initialScore, uint256 timestamp);

    /// @notice Emitted on collateral deposit
    event Deposited(address indexed agent, uint256 amount, uint256 newTotal);

    /// @notice Emitted on borrow
    event Borrowed(address indexed agent, uint256 amount, uint256 creditScore, uint256 ltv);

    /// @notice Emitted on successful repayment
    event Repaid(address indexed agent, uint256 principal, uint256 interest, uint256 newScore);

    /// @notice Emitted on collateral withdrawal
    event Withdrawn(address indexed agent, uint256 amount);

    /// @notice Emitted when the AI oracle updates a credit score
    /// @dev Indexed by agent and timestamp so 0G Storage can build audit trail
    event ScoreUpdated(
        address indexed agent,
        uint256 oldScore,
        uint256 newScore,
        uint256 timestamp
    );

    /// @notice Emitted on liquidation
    event Liquidated(
        address indexed agent,
        address indexed liquidator,
        uint256 collateralSeized,
        uint256 liquidatorReward
    );

    /// @notice Emitted when the owner funds the lending pool
    event PoolFunded(address indexed funder, uint256 amount, uint256 newBalance);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "CreditFi: not owner");
        _;
    }

    modifier onlyRegistered() {
        require(agents[msg.sender].registered, "CreditFi: not registered");
        _;
    }

    modifier onlyRegisteredAgent(address agentAddr) {
        require(agents[agentAddr].registered, "CreditFi: agent not registered");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @notice Deploy the CreditFi protocol. The deployer becomes the owner
     *         and initial oracle for score updates.
     */
    constructor() {
        owner = msg.sender;
    }

    // ─── Pool Management ─────────────────────────────────────────────────────

    /**
     * @notice Fund the lending pool with 0G tokens (owner only)
     * @dev Called by the owner / treasury to seed the pool with initial liquidity.
     *      Individual agent collateral (deposit()) is tracked separately.
     */
    function fundPool() external payable onlyOwner {
        require(msg.value > 0, "CreditFi: fund zero");
        emit PoolFunded(msg.sender, msg.value, address(this).balance);
    }

    // ─── Registration ─────────────────────────────────────────────────────────

    /**
     * @notice Register as a new agent with a starter credit score of 500.
     *         Each wallet can only register once.
     */
    function register() external {
        require(!agents[msg.sender].registered, "CreditFi: already registered");
        agents[msg.sender] = Agent({
            creditScore:     INITIAL_SCORE,
            deposited:       0,
            borrowed:        0,
            borrowTimestamp: 0,
            totalRepaid:     0,
            defaultCount:    0,
            registered:      true
        });
        agentList.push(msg.sender);
        emit AgentRegistered(msg.sender, INITIAL_SCORE, block.timestamp);
    }

    // ─── Collateral ───────────────────────────────────────────────────────────

    /**
     * @notice Deposit 0G tokens as collateral to unlock borrowing power.
     *         More collateral + a higher credit score = larger credit limit.
     */
    function deposit() external payable onlyRegistered {
        require(msg.value > 0, "CreditFi: deposit zero");
        agents[msg.sender].deposited += msg.value;
        totalDeposited += msg.value;
        emit Deposited(msg.sender, msg.value, agents[msg.sender].deposited);
    }

    /**
     * @notice Withdraw free collateral. Requires no active borrow.
     * @param amount Amount in wei to withdraw
     */
    function withdraw(uint256 amount) external onlyRegistered {
        Agent storage agent = agents[msg.sender];
        require(agent.borrowed == 0, "CreditFi: repay borrow first");
        require(agent.deposited >= amount, "CreditFi: insufficient collateral");
        require(amount > 0, "CreditFi: withdraw zero");
        agent.deposited -= amount;
        totalDeposited  -= amount;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ─── Borrowing ────────────────────────────────────────────────────────────

    /**
     * @notice Borrow 0G tokens against deposited collateral.
     *         Credit score determines the LTV boost above the 50% base.
     *         Only one active borrow per agent is allowed.
     * @param amount Amount to borrow in wei
     */
    function borrow(uint256 amount) external onlyRegistered {
        Agent storage agent = agents[msg.sender];
        require(agent.borrowed == 0, "CreditFi: repay existing borrow first");
        require(amount > 0, "CreditFi: borrow zero");

        uint256 maxBorrow = _maxBorrowable(agent);
        require(amount <= maxBorrow, "CreditFi: exceeds credit limit");
        require(address(this).balance >= amount, "CreditFi: pool insufficient");

        agent.borrowed        = amount;
        agent.borrowTimestamp = block.timestamp;
        totalBorrowed        += amount;

        uint256 ltv = _ltvForScore(agent.creditScore);
        payable(msg.sender).transfer(amount);
        emit Borrowed(msg.sender, amount, agent.creditScore, ltv);
    }

    /**
     * @notice Repay outstanding borrow plus accrued interest.
     *         Triggers a +20 score boost on successful repayment.
     *         Any overpayment is refunded automatically.
     */
    function repay() external payable onlyRegistered {
        Agent storage agent = agents[msg.sender];
        require(agent.borrowed > 0, "CreditFi: no active borrow");

        uint256 interest       = _accruedInterest(agent);
        uint256 totalRepayment = agent.borrowed + interest;
        require(msg.value >= totalRepayment, "CreditFi: insufficient repayment");

        uint256 principal  = agent.borrowed;
        totalBorrowed     -= principal;
        agent.borrowed     = 0;
        agent.borrowTimestamp = 0;
        agent.totalRepaid += principal;

        // Refund overpayment
        if (msg.value > totalRepayment) {
            payable(msg.sender).transfer(msg.value - totalRepayment);
        }

        // Boost score on-time
        _updateScore(msg.sender, true);

        emit Repaid(msg.sender, principal, interest, agent.creditScore);
    }

    // ─── Liquidation ──────────────────────────────────────────────────────────

    /**
     * @notice Liquidate an undercollateralized position.
     *         The liquidator receives 5% of seized collateral as a reward.
     *         The agent's score is slashed by 100 points.
     * @param agentAddr Address of the agent to liquidate
     */
    function liquidate(address agentAddr)
        external
        onlyRegisteredAgent(agentAddr)
    {
        Agent storage agent = agents[agentAddr];
        require(agent.borrowed > 0, "CreditFi: no active borrow");
        require(_isUndercollateralized(agent), "CreditFi: position healthy");

        uint256 seized    = agent.deposited;
        uint256 reward    = (seized * LIQUIDATOR_REWARD_BP) / 10000;

        totalDeposited   -= seized;
        totalBorrowed    -= agent.borrowed;

        agent.deposited       = 0;
        agent.borrowed        = 0;
        agent.borrowTimestamp = 0;
        agent.defaultCount   += 1;

        // Slash score
        _updateScore(agentAddr, false);

        payable(msg.sender).transfer(reward);
        emit Liquidated(agentAddr, msg.sender, seized, reward);
    }

    // ─── Score Oracle (0G Compute integration) ────────────────────────────────

    /**
     * @notice Update an agent's credit score — called by the owner acting as
     *         the 0G Compute oracle after the off-chain GBM model runs inference.
     * @param agentAddr Target agent address
     * @param newScore  AI-computed score (300–850) from 0G Compute Network
     */
    function updateCreditScore(address agentAddr, uint256 newScore)
        external
        onlyOwner
        onlyRegisteredAgent(agentAddr)
    {
        require(
            newScore >= MIN_CREDIT_SCORE && newScore <= MAX_CREDIT_SCORE,
            "CreditFi: invalid score"
        );
        uint256 old = agents[agentAddr].creditScore;
        agents[agentAddr].creditScore = newScore;
        emit ScoreUpdated(agentAddr, old, newScore, block.timestamp);
    }

    /**
     * @notice Batch update credit scores for multiple agents in one tx.
     *         Gas-efficient oracle settlement for the 0G Compute integration.
     * @param addrs  Array of agent addresses
     * @param scores Matching array of new credit scores
     */
    function batchUpdateScores(address[] calldata addrs, uint256[] calldata scores)
        external
        onlyOwner
    {
        require(addrs.length == scores.length, "CreditFi: length mismatch");
        for (uint256 i = 0; i < addrs.length; i++) {
            if (!agents[addrs[i]].registered) continue;
            uint256 s = scores[i];
            if (s < MIN_CREDIT_SCORE || s > MAX_CREDIT_SCORE) continue;
            uint256 old = agents[addrs[i]].creditScore;
            agents[addrs[i]].creditScore = s;
            emit ScoreUpdated(addrs[i], old, s, block.timestamp);
        }
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /**
     * @notice Get full agent struct for a given address
     */
    function getAgent(address agentAddr) external view returns (Agent memory) {
        return agents[agentAddr];
    }

    /**
     * @notice Get the maximum amount an agent can currently borrow
     */
    function maxBorrowable(address agentAddr) external view returns (uint256) {
        return _maxBorrowable(agents[agentAddr]);
    }

    /**
     * @notice Get accrued interest for an agent's current borrow
     */
    function accruedInterest(address agentAddr) external view returns (uint256) {
        return _accruedInterest(agents[agentAddr]);
    }

    /**
     * @notice Get total amount owed (principal + interest) for an agent
     */
    function totalOwed(address agentAddr) external view returns (uint256) {
        Agent storage agent = agents[agentAddr];
        if (agent.borrowed == 0) return 0;
        return agent.borrowed + _accruedInterest(agent);
    }

    /**
     * @notice Get current lending pool balance (excludes locked collateral)
     */
    function poolBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get total number of registered agents
     */
    function agentCount() external view returns (uint256) {
        return agentList.length;
    }

    /**
     * @notice Get a paginated slice of registered agent addresses.
     *         Useful for the frontend leaderboard and 0G Storage indexing.
     * @param offset Starting index (0-based)
     * @param limit  Max agents to return
     */
    function getAgentList(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory)
    {
        uint256 total  = agentList.length;
        if (offset >= total) return new address[](0);
        uint256 end    = offset + limit > total ? total : offset + limit;
        uint256 count  = end - offset;
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = agentList[offset + i];
        }
        return result;
    }

    /**
     * @notice Check whether an agent's position is currently undercollateralized
     */
    function isUndercollateralized(address agentAddr) external view returns (bool) {
        return _isUndercollateralized(agents[agentAddr]);
    }

    /**
     * @notice Get the effective LTV% for a given credit score
     * @param score Credit score (300–850)
     */
    function ltvForScore(uint256 score) external pure returns (uint256) {
        if (score < MIN_CREDIT_SCORE) return BASE_LTV;
        if (score > MAX_CREDIT_SCORE) return MAX_LTV;
        return _ltvForScore(score);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _maxBorrowable(Agent storage agent) internal view returns (uint256) {
        uint256 ltv = _ltvForScore(agent.creditScore);
        return (agent.deposited * ltv) / 100;
    }

    function _ltvForScore(uint256 score) internal pure returns (uint256) {
        // 50% base + linear boost to 75% at score 850
        // LTV = 50 + (score - 300) * 25 / 550
        return BASE_LTV + ((score - MIN_CREDIT_SCORE) * (MAX_LTV - BASE_LTV)) / (MAX_CREDIT_SCORE - MIN_CREDIT_SCORE);
    }

    function _accruedInterest(Agent storage agent) internal view returns (uint256) {
        if (agent.borrowed == 0 || agent.borrowTimestamp == 0) return 0;
        uint256 elapsed = block.timestamp - agent.borrowTimestamp;
        return (agent.borrowed * INTEREST_RATE_BPS * elapsed) / (SECONDS_PER_YEAR * 10000);
    }

    function _isUndercollateralized(Agent storage agent) internal view returns (bool) {
        uint256 owed   = agent.borrowed + _accruedInterest(agent);
        uint256 maxLTV = (agent.deposited * MAX_LTV) / 100;
        return owed > maxLTV;
    }

    function _updateScore(address agentAddr, bool repaid) internal {
        Agent storage agent = agents[agentAddr];
        if (repaid) {
            uint256 newScore = agent.creditScore + REPAY_SCORE_BOOST;
            agent.creditScore = newScore > MAX_CREDIT_SCORE ? MAX_CREDIT_SCORE : newScore;
        } else {
            agent.creditScore = agent.creditScore > DEFAULT_SCORE_SLASH + MIN_CREDIT_SCORE
                ? agent.creditScore - DEFAULT_SCORE_SLASH
                : MIN_CREDIT_SCORE;
        }
        emit ScoreUpdated(agentAddr, agent.creditScore, agent.creditScore, block.timestamp);
    }

    /// @notice Accept plain ETH / OG token deposits to fund the pool
    receive() external payable {}
}
