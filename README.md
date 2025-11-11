# Smart Lab Web of Things (WoT)

This project implements a Web of Things (WoT) environment simulating a smart laboratory. It consists of three interconnected virtual devices: a Lamp, a Motion Sensor, and a Thermostat.

The system is built on a distributed architecture where each device operates as an independent web service. A central Gateway manages the device registry, user authentication, and real-time event propagation. Interaction is handled via RESTful interfaces and WebSockets for event-driven communication.

## 🚀 Features

* **Microservice Architecture**: Each device (Lamp, Thermostat, Sensor) is an independent Node.js service.
* **Discovery and Registration**: Devices automatically register with the gateway on startup using a secure "System Token".
* **Real-Time Dashboard**: A web interface connects via Socket.IO to receive live status updates and control the devices.
* **Secure Authentication**: Token-based authentication system for users, with password hashing (bcrypt).
* **Rule Engine**: A central service on the gateway applies automation rules based on device states.
* **Event Logging**: All actions (connections, manual actions, state changes) are logged to the MongoDB database.
* **Physical Simulation**: The thermostat actively simulates temperature changes based on its current mode and target.

## 🏗️ System Architecture

The system is composed of the following services, each running on a separate port:

* **Gateway**: `http://localhost:3000`
    * Central coordination point.
    * Manages the device registry, authentication (users and system), and the Socket.IO server.
    * Hosts the rule engine.


* **Lamp Service**: `http://localhost:3001`
    * Exposes actions (`turnOn`, `turnOff`, `setColor`, `setBrightness`) and properties (`on`, `color`, `brightness`).


* **Thermostat Service**: `http://localhost:3002`
    * Exposes actions (`setMode`, `setTarget`) and properties (`currentTemperature`, `targetTemperature`, `mode`).
    * Simulates its own temperature.


* **Motion Sensor Service**: `http://localhost:3003`
    * Exposes the action (`simulateMotion`) and properties (`motion`, `lastDetected`).


* **Database**: `mongodb://localhost:27017/smartlab`
    * Stores users and event logs.


* **Dashboard (Client)**
    * Web interface (HTML, CSS, JS) for user interaction.

## 🛠️ Tech Stack

* **Backend**: Node.js
* **Framework**: Express.js
* **Real-time Communication**: Socket.IO
* **Database**: MongoDB with Mongoose
* **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
* **Security**: `bcrypt` hashing, Custom authentication tokens.

## ⚙️ Installation and Launch

### Prerequisites

* Node.js (v18+)
* `npm` (or `yarn`)
* MongoDB (local server running)

### Installation Steps

1.  **Clone the repository** (if applicable)
    ```sh
    git clone [YOUR_REPO_URL]
    cd [YOUR_PROJECT_FOLDER]
    ```

2.  **Install dependencies**
    (Assuming a `package.json` exists at the root or in each service folder)
    ```sh
    npm install
    ```
    *Note: You may need to run this in each service folder (`gateway`, `services/lamp`, etc.) if dependencies are managed separately.*

3.  **Start the database**
    Ensure your MongoDB service is running on the default port (27017).

4.  **Start the services (Order is Important!)**

    You must **start the Gateway first**. On its first launch, it creates the `system` user and generates a `SYSTEM_TOKEN` in a `.env` file at the root. The other services need this token to register.

    Open **4 separate terminals**:

    * **Terminal 1: Gateway**
        ```sh
        # Option 1: Using node
        node gateway/index.js
        # Option 2: Using npm script
        npm run dev 
        
        # Wait to see: "Gateway on :3000" and "SYSTEM_TOKEN saved to .env"
        ```

    * **Terminal 2: Lamp Service**
        ```sh
        # Option 1: Using node
        node services/lamp/app.js
        # Option 2: Using npm script
        npm run dev 

        # Should display: "Lamp registered with ID: lamp-..."
        ```

    * **Terminal 3: Thermostat Service**
        ```sh
        # Option 1: Using node
        node services/thermostat/app.js
        # Option 2: Using npm script
        npm run dev 

        # Should display: "Thermostat registered with ID: thermostat-..."
        ```

    * **Terminal 4: Motion Sensor Service**
        ```sh
        # Option 1: Using node
        node services/motion/app.js
        # Option 2: Using npm script
        npm run dev 

        # Should display: "Motion Sensor registered with ID: motion-..."
        ```
    *(Note: Adjust paths like `gateway/index.js` based on your project structure. `npm run dev` assumes you have a `dev` script defined in the `package.json` of each service.)*

5.  **Access the Dashboard**
    Open the `dashboard/index.html` file in your browser.
    *You can use a browser extension like "Live Server" in VS Code to serve it locally.*

## 🧠 Automation Rules (Implemented)

The Rule Engine (`RuleEngine.js`) applies the following logic (based on the source code):

1.  **Light on Detection**
    * **If**: `motion` is detected (becomes `true`) AND the lamp is off.
    * **Then**: The lamp turns on (`turnOn`).
    * **And**: The lamp turns off (`turnOff`) automatically after **2 seconds**.

2.  **Comfort Heating**
    * **If**: The thermostat's `currentTemperature` is **< 18°C** AND `motion` is active.
    * **Then**: The thermostat switches to `comfort` mode.

3.  **Energy Saving (Inactivity)**
    * **If**: 5 minutes have passed since the `lastDetected` motion.
    * **Then**: The lamp turns off (`turnOff`) AND the thermostat switches to `eco` mode.
    * *(This rule is checked every 30 seconds)*.

4.  **Manual Override**
    * **If**: A user manually changes the thermostat mode (`mode: 'manual'`).
    * **Then**: All automation rules (above) are suspended for **30 seconds** to respect the user's intent.