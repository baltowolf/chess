package chess.backend.service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.*;
import java.util.concurrent.TimeUnit;

@Service
public class StockfishService {

    private static final Logger log = LoggerFactory.getLogger(StockfishService.class);

    private Process process;
    private BufferedReader reader;
    private BufferedWriter writer;

    @PostConstruct
    public void startEngine() {
        try {
            process = new ProcessBuilder("C:\\Users\\Alex\\chess\\stockfish\\stockfish-windows-x86-64-avx2.exe").start();
            reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream()));

            // Initialize UCI
            sendCommand("uci");
            waitFor("uciok");

            // Set some defaults
            sendCommand("setoption name Threads value 1");
            sendCommand("setoption name Hash value 16");
            sendCommand("isready");
            waitFor("readyok");

            log.info("Stockfish engine started successfully.");
        } catch (IOException e) {
            log.error("Failed to start Stockfish engine. In test environments without Stockfish, this error may be expected.", e);
        }
    }

    @PreDestroy
    public void stopEngine() {
        try {
            sendCommand("quit");
            if (process != null) {
                process.waitFor(2, TimeUnit.SECONDS);
                process.destroy();
            }
        } catch (Exception e) {
            log.error("Error stopping engine", e);
        }
    }

    public synchronized void sendCommand(String command) {
        if (writer == null) return;
        try {
            log.debug("Engine IN: {}", command);
            writer.write(command + "\n");
            writer.flush();
        } catch (IOException e) {
            log.error("Failed to send command to Stockfish", e);
        }
    }

    public synchronized String waitFor(String target) {
        if (reader == null) return "";
        StringBuilder output = new StringBuilder();
        try {
            String line;
            while ((line = reader.readLine()) != null) {
                log.debug("Engine OUT: {}", line);
                output.append(line).append("\n");
                if (line.contains(target)) {
                    break;
                }
            }
        } catch (IOException e) {
            log.error("Failed to read from Stockfish", e);
        }
        return output.toString();
    }

    public synchronized void setDifficulty(int elo) {
        sendCommand("setoption name UCI_LimitStrength value true");
        sendCommand("setoption name UCI_Elo value " + elo);
        sendCommand("isready");
        waitFor("readyok");
    }

    public synchronized String getBestMove(String fen, int moveTimeMs) {
        sendCommand("position fen " + fen);
        sendCommand("go movetime " + moveTimeMs);

        String output = waitFor("bestmove");
        // Output looks like: bestmove e2e4 ponder e7e5
        String[] parts = output.split("bestmove ");
        if (parts.length > 1) {
            String bestMovePart = parts[1].split(" ")[0];
            return bestMovePart.trim();
        }
        return null;
    }
}
