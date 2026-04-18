package com.sterni.dailystudy.ui.screens.tools

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.ui.theme.Primary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleUploadScreen(onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("הטענת מאמרים") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "חזור")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("הטענת קבצי PDF - מאמרי חסידות", fontSize = 20.sp, fontWeight = FontWeight.Bold)
            
            OutlinedButton(
                onClick = { /* TODO Launch File Picker for PDF */ },
                modifier = Modifier.fillMaxWidth().height(60.dp)
            ) {
                Icon(Icons.Default.FileUpload, contentDescription = "בחר קובץ")
                Spacer(modifier = Modifier.width(8.dp))
                Text("בחר קובץ PDF מספריית המכשיר", fontSize = 16.sp)
            }
            
            Text(
                "המאמרים ינותחו להצגה קריאה כטקסט באפליקציה, או להורדה אופליין",
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Divider()

            Text("המאמרים המוטענים שלך:", fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.align(Alignment.Start))
            
            // Empty list mockup
            Text("לא הועלו מאמרים אישיים", color = MaterialTheme.colorScheme.error)
        }
    }
}