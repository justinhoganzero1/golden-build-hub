package app.oraclelunar.ai;

import android.app.UiModeManager;
import android.content.res.Configuration;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // On Google TV / Android TV, tell the app so the remote's arrow keys
        // move a visible highlight between buttons.
        try {
            UiModeManager ui = (UiModeManager) getSystemService(UI_MODE_SERVICE);
            if (ui != null && ui.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION && getBridge() != null) {
                WebView web = getBridge().getWebView();
                WebSettings settings = web.getSettings();
                String ua = settings.getUserAgentString();
                if (ua == null || !ua.contains("OracleLunarTV")) {
                    settings.setUserAgentString((ua == null ? "" : ua) + " OracleLunarTV");
                }
            }
        } catch (Exception ignored) {
            // Never block start-up over TV detection.
        }
    }
}
